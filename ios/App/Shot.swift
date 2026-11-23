// وضع التصوير والفحص (لبناء المحاكي فقط، لا يدخل نسخة TestFlight):
// «-shot <اسم>» يفتح شاشة بعينها ويكتب Documents/shot-ready.txt حين تجهز،
// و«-selfcheck» يزن أبياتاً معروفة البحور ويكتب النتيجة في Documents/selfcheck.txt.
#if DEBUG
import SwiftUI
import UIKit

enum Shot {
    static let name: String? = {
        let a = ProcessInfo.processInfo.arguments
        if let i = a.firstIndex(of: "-shot"), i + 1 < a.count { return a[i + 1] }
        return nil
    }()
    static var selfcheck: Bool { ProcessInfo.processInfo.arguments.contains("-selfcheck") }
    static var docs: URL { FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0] }

    @MainActor static var launched = false

    @MainActor static func afterLaunch(_ app: AppState) {
        if launched { return }
        launched = true
        if selfcheck { Task { await runSelfCheck() } }
        guard let n = name else { return }
        Task { @MainActor in
            await waitForCore()
            switch n {
            case "weigh":
                app.weigh("قفا نبكِ من ذكرى حبيبٍ ومنزلِ * بسِقطِ اللوى بين الدَّخولِ فحوملِ")
            case "broken":
                app.weigh("الخيلُ والليلُ والبيداءُ تعرفني * والسيفُ والرمحُ والقرطاسُ والقلمُ الحادُ")
            case "poem3":
                app.weigh("لقد ضاع منا الصبر والحلم كله * وبات الفؤاد يذوب من غيره\nقفا نبك من ذكرى حبيب ومنزل * بسقط اللوى بين الدخول فحومل")
            case "write": app.tab = .write
            case "write-done", "craft":
                app.tab = .write
                await ComposeRunner.shared.demo()
            case "anthology": app.tab = .anthology
            case "diwans": app.tab = .diwans
            case "poem": app.openPoem(diwan: "mutanabbi", poem: 0, verse: 2)
            case "musajala":
                app.tab = .musajala
                app.shotLetter = "ل"
            case "settings": app.showSettings = true
            default: break
            }
            let wait: Double = ["write-done": 5, "craft": 6, "weigh": 4, "broken": 4, "poem3": 5, "poem": 5, "diwans": 3, "musajala": 4][n] ?? 3
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            try? "ready \(n)".write(to: docs.appendingPathComponent("shot-ready.txt"), atomically: true, encoding: .utf8)
        }
    }

    @MainActor static func waitForCore() async {
        for _ in 0..<240 {
            if CoreStatus.shared.ready || CoreStatus.shared.error != nil { return }
            try? await Task.sleep(nanoseconds: 250_000_000)
        }
    }

    /// أبيات معروفة البحور: يجب أن يصيبها المحرك داخل التطبيق كما يصيبها في الموقع
    static let cases: [(String, String)] = [
        ("قفا نبكِ من ذكرى حبيبٍ ومنزلِ * بسِقطِ اللوى بين الدَّخولِ فحوملِ", "الطويل"),
        ("الخيلُ والليلُ والبيداءُ تعرفني * والسيفُ والرمحُ والقرطاسُ والقلمُ", "البسيط"),
        ("إذا غامرتَ في شرفٍ مرومِ * فلا تقنعْ بما دونَ النجومِ", "الوافر"),
        ("وإذا أتتكَ مذمّتي من ناقصٍ * فهي الشهادةُ لي بأنّي كاملُ", "الكامل"),
        ("ليسَ الغريبُ غريبَ الشامِ واليمنِ * إنّ الغريبَ غريبُ اللحدِ والكفنِ", "البسيط"),
        ("وللهِ في كلِّ تحريكةٍ * وتسكينةٍ أبداً شاهدُ", "المتقارب"),
    ]

    @MainActor static func runSelfCheck() async {
        var lines: [String] = []
        let t0 = Date()
        await waitForCore()
        lines.append(String(format: "core ready=%@ dict=%d in %.1fs", CoreStatus.shared.ready ? "yes" : "no", CoreStatus.shared.dictSize, Date().timeIntervalSince(t0)))
        if let e = CoreStatus.shared.error { lines.append("core error: " + e) }
        var ok = CoreStatus.shared.ready
        for (verse, want) in cases {
            let t = Date()
            do {
                let o = try await WaznCore.shared.weigh(verse)
                let r = o.items.first
                let good = r?.meter == want && r?.exact == true
                if !good { ok = false }
                lines.append(String(format: "%@ %@ (want %@) %.2fs", good ? "OK" : "FAIL", r?.title ?? "nil", want, Date().timeIntervalSince(t)))
            } catch {
                ok = false
                lines.append("FAIL \(want): \(error.localizedDescription)")
            }
        }
        // البيانات
        do {
            let a = try await Library.shared.loadAnthology()
            let ix = try await Library.shared.loadIndex()
            let s = try await Library.shared.loadSaj()
            let d = try await Library.shared.loadDiwan("mutanabbi")
            lines.append("data: anthology=\(a.items.count) diwans=\(ix.count) saj=\(s.count) mutanabbi poems=\(d.poems.count)")
        } catch {
            ok = false
            lines.append("data FAIL: \(error)")
        }
        let models = await WaznCore.shared.models()
        let st = try? await WaznCore.shared.settings()
        lines.append("models=\(models.map(\.id)) settings=\(st.map { "\($0.composeModel)/\($0.fixModel)/\($0.autoFix)" } ?? "nil")")
        if models.count != 2 || st == nil { ok = false }
        let last = await WaznCore.shared.lastLetter("بسقط اللوى بين الدخول فحوملِ")
        lines.append("lastLetter=\(last)")
        if last != "ل" { ok = false }
        lines.append(ok ? "SELFCHECK OK" : "SELFCHECK FAILED")
        try? lines.joined(separator: "\n").write(to: docs.appendingPathComponent("selfcheck.txt"), atomically: true, encoding: .utf8)
    }
}
#endif
