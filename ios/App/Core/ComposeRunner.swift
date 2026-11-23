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
    /// البيت الذي يُعاد نظمه الآن، وحاله
    @Published private(set) var regenIndex: Int?
    @Published private(set) var regenStatus = ""
    @Published var regenError: AIFailure?

    /// يزيد عند كل نظم جديد أو إيقاف، فيُهمل ما يصل من نظم أُوقف
    private var runID = 0
    private var startedAt = Date()
    private var heartbeat: Timer?
    private var observers: [NSObjectProtocol] = []

    private var bgTask: UIBackgroundTaskIdentifier = .invalid
    private var continued: AnyObject?          // BGContinuedProcessingTask (iOS 26+)
    private var continuedID: String?

    static let taskPrefix = "com.gts2svg.wazn.compose"
    private static let savedKey = "wazn.lastPoem"

    var isRunning: Bool { if case .running = phase { return true }; return false }

    init() {
        // خروج المستخدم من التطبيق ورجوعه في أثناء النظم يُكتب في السجل
        let nc = NotificationCenter.default
        observers.append(nc.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in
                let r = ComposeRunner.shared
                guard r.isRunning else { return }
                ComposeLog.shared.add("◐ خرج المستخدم من التطبيق (وقت الخلفية المتبقي: \(Int(min(UIApplication.shared.backgroundTimeRemaining, 9999)))ث، مهمة iOS 26: \(r.continued == nil ? "لم تبدأ" : "تعمل"))")
                ComposeLog.shared.save()
            }
        })
        observers.append(nc.addObserver(forName: UIApplication.willEnterForegroundNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in
                if ComposeRunner.shared.isRunning { ComposeLog.shared.add("◑ رجع المستخدم إلى التطبيق") }
            }
        })
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
        runID += 1
        let myRun = runID
        phase = .running
        status = "يتأمّل ويخطّط للقصيدة…"
        autoIDs = []
        lastParams = p
        startedAt = Date()
        ComposeLog.shared.begin("نظم: \(p.purpose)، \(p.count) أبيات، البحر \(p.meter ?? "يختاره الشاعر")، الروي \(p.rawi ?? "يختاره الشاعر")")
        askNotificationPermission()
        beginBackground(p)
        startHeartbeat()

        Task { @MainActor in
            do {
                let r = try await WaznCore.shared.compose(p) { [weak self] m in
                    guard let self, self.runID == myRun else { return }
                    ComposeLog.shared.add("● \(m)")
                    self.status = m
                    self.reportProgress(m)
                }
                guard runID == myRun else { return }
                ComposeLog.shared.end("✓ تمّت في \(ComposeLog.mmss(Date().timeIntervalSince(startedAt))) · جولات الإصلاح \(r.rounds) · الموزون \(r.verses.filter(\.ok).count) من \(r.verses.count)")
                stopHeartbeat()
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
                guard runID == myRun else { return }
                ComposeLog.shared.end("✗ فشل: \(e.message) \(e.diag)")
                stopHeartbeat()
                phase = .failed(e)
                notifyFailed(e.message)
                endBackground(success: false)
            } catch {
                guard runID == myRun else { return }
                ComposeLog.shared.end("✗ فشل: \(error.localizedDescription)")
                stopHeartbeat()
                let e = AIFailure(message: "حدث خطأ: " + error.localizedDescription, diag: "", raw: "")
                phase = .failed(e)
                notifyFailed(e.message)
                endBackground(success: false)
            }
            status = ""
        }
    }

    /// زر «أوقف»: يقطع الطلب الجاري ويرجع إلى الاختيار
    func cancel() {
        guard isRunning else { return }
        runID += 1
        ComposeLog.shared.end("■ أوقفه المستخدم بعد \(ComposeLog.mmss(Date().timeIntervalSince(startedAt)))")
        WaznCore.shared.cancelAll()
        stopHeartbeat()
        endBackground(success: false)
        status = ""
        phase = .idle
    }

    // MARK: - نبض للنظام

    /// يبلّغ iOS بالتقدم كل ثلاث ثوانٍ، فلا يظن مهمة الخلفية متوقفة في أثناء طلب طويل
    private func startHeartbeat() {
        heartbeat?.invalidate()
        heartbeat = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in
            Task { @MainActor in ComposeRunner.shared.beat() }
        }
    }

    private func stopHeartbeat() {
        heartbeat?.invalidate()
        heartbeat = nil
    }

    private func beat() {
        guard isRunning else { stopHeartbeat(); return }
        if #available(iOS 26.0, *), let t = continued as? BGContinuedProcessingTask {
            let p = t.progress
            if p.completedUnitCount < 95 { p.completedUnitCount += 1 }
            t.updateTitle(t.title, subtitle: "\(status) · \(ComposeLog.mmss(Date().timeIntervalSince(startedAt)))")
        }
    }

    /// يعيد نظم بيت واحد ويُبقي غيره
    func regenerate(_ index: Int) {
        guard case .done(var out) = phase, let p = lastParams, regenIndex == nil, out.verses.indices.contains(index) else { return }
        regenIndex = index
        regenStatus = "ينظم بيتاً بديلاً…"
        regenError = nil
        Task { @MainActor in
            do {
                let v = try await WaznCore.shared.regenerateVerse(p, poem: out, index: index) { [weak self] m in self?.regenStatus = m }
                out.verses[index] = v
                phase = .done(out)
                save(out, p)
            } catch let e as AIFailure {
                regenError = e
            } catch {
                regenError = AIFailure(message: "حدث خطأ: " + error.localizedDescription, diag: "", raw: "")
            }
            regenIndex = nil
            regenStatus = ""
        }
    }

    /// يعتمد صياغة أخرى بدل التي اختارها الناقد، وتصير المختارة بين البدائل
    func adopt(_ alt: AltDraft) {
        guard case .done(var out) = phase, var alts = out.alternatives, let i = alts.firstIndex(of: alt) else { return }
        let previous = AltDraft(number: out.chosen ?? 1, verses: out.verses)
        out.verses = alt.verses
        out.chosen = alt.number
        alts[i] = previous
        alts.sort { $0.number < $1.number }
        out.alternatives = alts
        phase = .done(out)
        if let p = lastParams { save(out, p) }
    }

    #if DEBUG
    /// لوضع التصوير: قصيدة جاهزة موزونة بالمحرك الحقيقي
    func demo() async {
        let vs = [("على قدرِ أهلِ العزمِ تأتي العزائمُ", "وتأتي على قدرِ الكرامِ المكارمُ"),
                  ("وتعظُمُ في عينِ الصغيرِ صغارُها", "وتصغُرُ في عينِ العظيمِ العظائمُ"),
                  ("يُكلِّفُ سيفُ الدولةِ الجيشَ همَّهُ", "وقد عجزتْ عنه الجيوشُ الخضارمُ"),
                  ("ويطلبُ عند الناسِ ما عند نفسِه", "وذلك ما لا تدّعيه الضراغمُ")]
        let crafts = ["مقابلة بين «أهل العزم» و«الكرام» و«العزائم» و«المكارم»، وتصريع المطلع",
                      "طباق بين «تعظم» و«تصغر» و«الصغير» و«العظيم»، ورد العجز على الصدر",
                      "استعارة: جعل للهمّ ثقلاً يُكلَّف به الجيش",
                      "مقابلة بين ما عند الناس وما عند النفس"]
        var out: [ComposedVerse] = []
        for (i, v) in vs.enumerated() {
            let o = try? await WaznCore.shared.weigh(v.0 + " * " + v.1)
            let r = o?.items.first
            out.append(ComposedVerse(sadr: v.0, ajz: v.1, ok: r?.exact == true, craft: crafts[i], result: r))
        }
        let alt = AltDraft(number: 2, verses: Array(out.reversed()))
        phase = .done(ComposeOutput(meter: "الطويل", rawi: "م", haraka: "الضمة", rounds: 1, verses: out,
                                    chosen: 1, verdict: "اخترت الأولى لتماسك معانيها وقوة مطلعها، وأعدت نظم البيت الرابع لأنه جاء خبراً بارداً.",
                                    alternatives: [alt, AltDraft(number: 3, verses: Array(out.prefix(2)))]))
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
            ComposeLog.shared.add("◆ انتهت مهلة الخلفية القصيرة")
            ComposeLog.shared.save()
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
                    ComposeLog.shared.add("◆ بدأت مهمة الخلفية (iOS 26)")
                    t.expirationHandler = {
                        ComposeLog.shared.add("◆ أوقف النظامُ مهمةَ الخلفية")
                        ComposeLog.shared.save()
                        Task { @MainActor in ComposeRunner.shared.continued = nil }
                    }
                }
            }
            if ok {
                let req = BGContinuedProcessingTaskRequest(identifier: id, title: "«وزن» ينظم القصيدة", subtitle: "قصيدة في \(p.purpose)")
                req.strategy = .fail
                do { try BGTaskScheduler.shared.submit(req) } catch {
                    NSLog("[wazn] continued task: %@", "\(error)")
                    ComposeLog.shared.add("◆ رُفض طلب مهمة الخلفية: \(error.localizedDescription)")
                }
            } else {
                ComposeLog.shared.add("◆ لم يُسجَّل معرّف مهمة الخلفية")
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
