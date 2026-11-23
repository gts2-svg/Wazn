// يدير «انظم» خارج الشاشة: يبقى التأليف ماضياً إذا خرج المستخدم من التطبيق (مهمة خلفية يبدأها المستخدم بيده)،
// ويُشعره حين تجهز القصيدة، ويحفظ آخر قصيدة فلا تضيع.
import Foundation
import UIKit
import BackgroundTasks
import UserNotifications

@MainActor
final class ComposeRunner: ObservableObject {
    static let shared = ComposeRunner()

    enum Phase {
        case idle
        case running
        case done(ComposeOutput)
        case failed(AIFailure)
    }

    @Published private(set) var phase: Phase = .idle
    @Published private(set) var status = ""
    @Published private(set) var autoIDs: Set<Int> = []
    @Published private(set) var lastParams: ComposeParams?
    /// يزيد كلما جهزت قصيدة جديدة، لتنتقل الشاشة إليها
    @Published private(set) var revision = 0

    private var bgTask: UIBackgroundTaskIdentifier = .invalid
    private var continued: AnyObject?          // BGContinuedProcessingTask (iOS 26+)
    private var continuedID: String?

    static let taskPrefix = "com.gts2svg.wazn.compose"
    private static let savedKey = "wazn.lastPoem"

    var isRunning: Bool { if case .running = phase { return true }; return false }

    init() {
        if let d = UserDefaults.standard.data(forKey: Self.savedKey),
           let s = try? JSONDecoder().decode(SavedPoem.self, from: d) {
            phase = .done(s.output)
            lastParams = s.params
        }
    }

    func clear() {
        guard !isRunning else { return }
        phase = .idle
        UserDefaults.standard.removeObject(forKey: Self.savedKey)
    }

    func start(_ p: ComposeParams) {
        guard !isRunning else { return }
        phase = .running
        status = "يفكّر ويكتب الأبيات… (قد يأخذ دقيقة)"
        autoIDs = []
        lastParams = p
        askNotificationPermission()
        beginBackground(p)

        Task { @MainActor in
            do {
                let r = try await WaznCore.shared.compose(p) { [weak self] m in
                    self?.status = m
                    self?.reportProgress(m)
                }
                var auto: Set<Int> = []
                if let s = try? await WaznCore.shared.settings(), s.autoFix {
                    let limit = await WaznCore.shared.autoFixLimit()
                    auto = Set(r.verses.filter { !$0.ok }.compactMap { $0.result?.id }.prefix(limit))
                }
                autoIDs = auto
                phase = .done(r)
                revision += 1
                save(r, p)
                notifyDone(r)
                endBackground(success: true)
            } catch let e as AIFailure {
                phase = .failed(e)
                notifyFailed(e.message)
                endBackground(success: false)
            } catch {
                let e = AIFailure(message: "حدث خطأ: " + error.localizedDescription, diag: "", raw: "")
                phase = .failed(e)
                notifyFailed(e.message)
                endBackground(success: false)
            }
            status = ""
        }
    }

    #if DEBUG
    /// لوضع التصوير: قصيدة جاهزة موزونة بالمحرك الحقيقي
    func demo() async {
        let vs = [("على قدرِ أهلِ العزمِ تأتي العزائمُ", "وتأتي على قدرِ الكرامِ المكارمُ"),
                  ("وتعظُمُ في عينِ الصغيرِ صغارُها", "وتصغُرُ في عينِ العظيمِ العظائمُ"),
                  ("يُكلِّفُ سيفُ الدولةِ الجيشَ همَّهُ", "وقد عجزتْ عنه الجيوشُ الخضارمُ"),
                  ("ويطلبُ عند الناسِ ما عند نفسِه", "وذلك ما لا تدّعيه الضراغمُ")]
        var out: [ComposedVerse] = []
        for v in vs {
            let o = try? await WaznCore.shared.weigh(v.0 + " * " + v.1)
            let r = o?.items.first
            out.append(ComposedVerse(sadr: v.0, ajz: v.1, ok: r?.exact == true, result: r))
        }
        phase = .done(ComposeOutput(meter: "الطويل", rawi: "م", haraka: "الضمة", rounds: 1, verses: out))
        revision += 1
    }
    #endif

    // MARK: - الحفظ

    private struct SavedPoem: Codable {
        let output: ComposeOutput
        let params: ComposeParams
    }

    private func save(_ r: ComposeOutput, _ p: ComposeParams) {
        if let d = try? JSONEncoder().encode(SavedPoem(output: r, params: p)) {
            UserDefaults.standard.set(d, forKey: Self.savedKey)
        }
    }

    // MARK: - العمل في الخلفية

    private func beginBackground(_ p: ComposeParams) {
        // مهلة قصيرة يمنحها النظام لأي تطبيق يخرج منه المستخدم
        bgTask = UIApplication.shared.beginBackgroundTask(withName: "wazn.compose") { [weak self] in
            Task { @MainActor in self?.endSystemTask() }
        }
        // ومهمة خلفية يبدأها المستخدم بيده، يُظهر النظام تقدّمها ويتركها تكمل (iOS 26 فما بعد)
        if #available(iOS 26.0, *) {
            let id = Self.taskPrefix + "." + UUID().uuidString.prefix(8).lowercased()
            continuedID = id
            let ok = BGTaskScheduler.shared.register(forTaskWithIdentifier: id, using: nil) { task in
                guard let t = task as? BGContinuedProcessingTask else { task.setTaskCompleted(success: false); return }
                Task { @MainActor in
                    let runner = ComposeRunner.shared
                    if !runner.isRunning { t.setTaskCompleted(success: true); return }
                    runner.continued = t
                    t.progress.totalUnitCount = 100
                    t.progress.completedUnitCount = 5
                    t.expirationHandler = {
                        Task { @MainActor in ComposeRunner.shared.continued = nil }
                    }
                }
            }
            if ok {
                let req = BGContinuedProcessingTaskRequest(identifier: id, title: "«وزن» ينظم القصيدة", subtitle: "قصيدة في \(p.purpose)")
                req.strategy = .fail
                do { try BGTaskScheduler.shared.submit(req) } catch { NSLog("[wazn] continued task: %@", "\(error)") }
            }
        }
    }

    private func reportProgress(_ m: String) {
        if #available(iOS 26.0, *), let t = continued as? BGContinuedProcessingTask {
            let p = t.progress
            p.completedUnitCount = min(95, p.completedUnitCount + 20)
            t.updateTitle(t.title, subtitle: m)
        }
    }

    private func endBackground(success: Bool) {
        if #available(iOS 26.0, *), let t = continued as? BGContinuedProcessingTask {
            t.progress.completedUnitCount = 100
            t.setTaskCompleted(success: success)
        }
        continued = nil
        endSystemTask()
    }

    private func endSystemTask() {
        if bgTask != .invalid {
            UIApplication.shared.endBackgroundTask(bgTask)
            bgTask = .invalid
        }
    }

    // MARK: - الإشعار

    private func askNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    private var inForeground: Bool { UIApplication.shared.applicationState == .active }

    private func notifyDone(_ r: ComposeOutput) {
        guard !inForeground else { return }
        let ok = r.verses.filter(\.ok).count
        let c = UNMutableNotificationContent()
        c.title = "القصيدة جاهزة"
        c.body = (r.verses.first.map { $0.sadr + " … " } ?? "") + (ok == r.verses.count ? "موزونة كلها" : "\(ok) من \(r.verses.count) موزونة")
        c.sound = .default
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "wazn.poem", content: c, trigger: nil))
    }

    private func notifyFailed(_ msg: String) {
        guard !inForeground else { return }
        let c = UNMutableNotificationContent()
        c.title = "تعذّر نظم القصيدة"
        c.body = msg
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "wazn.poem", content: c, trigger: nil))
    }
}
