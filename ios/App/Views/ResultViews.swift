// بطاقة نتيجة الوزن: البحر، والشارة، والشطران بتفعيلاتهما، وموضع الخطأ ووجهه، والتعديل المقترح.
import SwiftUI

struct ResultCard: View {
    let r: ResultUI
    var rawi = ""
    var haraka = ""
    var autoFix = false
    @EnvironmentObject var app: AppState
    @State private var fixing = false
    @State private var fixStatus = ""
    @State private var suggestions: [Suggestion]?
    @State private var fixError: AIFailure?
    @State private var needKey = false
    @State private var autoDone = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    if !r.label.isEmpty {
                        Text(r.label).font(.caption).foregroundStyle(C.muted)
                    }
                    Text(r.title).font(Fonts.verse(25, bold: true)).foregroundStyle(C.accent)
                }
                Spacer(minLength: 8)
                if let b = r.badge { Badge(text: b, ok: r.ok ?? false) }
            }

            if r.failed {
                ErrorBox(text: r.message ?? "تعذّر الوزن.")
            } else {
                ForEach(r.notes ?? [], id: \.self) { n in
                    Text(n).font(.subheadline).foregroundStyle(C.muted)
                }
                if let g = r.guesses, !g.isEmpty {
                    Text("شكّلتُ تقديراً (تحتها خط منقّط): \(g.map { "«\($0)»" }.joined(separator: "، ")). إن كان نطقها غير ذلك فشكّلها وأعد الوزن.")
                        .font(.subheadline).foregroundStyle(C.warn)
                }
                ForEach(Array((r.hemis ?? []).enumerated()), id: \.offset) { _, h in
                    HemiView(h: h)
                }
                problems
                if let a = r.alts, !a.isEmpty {
                    Text("يحتمل أيضاً: " + a.joined(separator: "، ")).font(.footnote).foregroundStyle(C.muted)
                }
                if r.needsFix == true { fixSection }
            }
        }
        .card()
        .task {
            guard autoFix, !autoDone, r.needsFix == true else { return }
            autoDone = true
            await runFix()
        }
    }

    @ViewBuilder private var problems: some View {
        let ps = r.problems ?? []
        let rs = r.rhymeIssues ?? []
        if !ps.isEmpty || !rs.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("موضع الخطأ ووجهه").font(.subheadline.weight(.bold)).foregroundStyle(C.bad)
                ForEach(Array(ps.enumerated()), id: \.offset) { _, p in
                    (Text(p.head + ": ").bold() + Text(p.what + ". ") + Text(p.can + ".").foregroundColor(C.muted))
                        .font(.subheadline)
                }
                ForEach(Array(rs.enumerated()), id: \.offset) { _, i in
                    (Text("القافية — \(i.kind): ").bold() + Text(i.msg + "."))
                        .font(.subheadline)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(C.badSoft.opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }

    @ViewBuilder private var fixSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                SmallButton(title: suggestions == nil ? "اقترح تعديلاً" : "اقتراحات أخرى", systemImage: "wand.and.stars") {
                    Task { await runFix() }
                }
                .disabled(fixing)
                if fixing { ProgressView() }
                if !fixStatus.isEmpty { Text(fixStatus).font(.footnote).foregroundStyle(C.muted) }
            }
            if needKey {
                HStack(spacing: 6) {
                    Text("التعديل المقترح يحتاج مفتاح API.").font(.footnote).foregroundStyle(C.muted)
                    Button("أضفه") { app.showSettings = true }.font(.footnote.weight(.semibold))
                }
            }
            if let s = suggestions {
                if s.isEmpty {
                    Text("ما سلمت الاقتراحات عند الفحص هذه المرة. اضغط «اقتراحات أخرى» لمحاولة أخرى.")
                        .font(.subheadline).foregroundStyle(C.muted)
                } else {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("التعديل المقترح").font(.subheadline.weight(.bold)).foregroundStyle(C.ok)
                        ForEach(Array(s.enumerated()), id: \.offset) { i, g in
                            if i > 0 { Divider() }
                            VStack(alignment: .leading, spacing: 6) {
                                Bayt(sadr: g.sadr, ajz: g.ajz, size: 20)
                                if !g.note.isEmpty { Text(g.note).font(.footnote).foregroundStyle(C.muted) }
                                HStack {
                                    Badge(text: "سليم الوزن على \(g.title)\(rawi.isEmpty ? "" : " والقافية") ✓", ok: true)
                                    Spacer()
                                    CopyButton(text: g.sadr + "    " + g.ajz)
                                }
                            }
                        }
                    }
                    .padding(12)
                    .background(C.okSoft.opacity(0.6))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
            }
            if let e = fixError {
                ErrorBox(text: e.message)
                DisclosureGroup("تفاصيل الخطأ") {
                    Text(e.details).font(.caption.monospaced()).textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(.footnote)
            }
        }
    }

    private func runFix() async {
        if fixing { return }
        guard await WaznCore.shared.hasKey() else { needKey = true; return }
        needKey = false
        fixing = true
        fixError = nil
        defer { fixing = false; fixStatus = "" }
        do {
            suggestions = try await WaznCore.shared.suggestFix(id: r.id, rawi: rawi, haraka: haraka) { m in fixStatus = m }
        } catch let e as AIFailure {
            fixError = e
        } catch {
            fixError = AIFailure(message: error.localizedDescription, diag: "", raw: "")
        }
    }
}

/// شطر: كلماته (المكسورة بالأحمر والمقدّرة بخط منقّط)، ثم تفعيلاته
struct HemiView: View {
    let h: HemiUI

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(h.label).font(.caption.weight(.semibold)).foregroundStyle(C.muted)
            wordsText.font(Fonts.verse(21)).lineSpacing(4).frame(maxWidth: .infinity, alignment: .leading)
            let cols = max(1, min(4, h.half > 0 ? Int(h.half) : h.feet.count))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: cols), spacing: 6) {
                ForEach(Array(h.feet.enumerated()), id: \.offset) { _, f in
                    FootCell(f: f)
                }
            }
        }
    }

    private var wordsText: Text {
        var out = Text("")
        for (i, w) in h.words.enumerated() {
            var t = Text(w.t)
            if w.broken { t = t.foregroundColor(C.bad).bold() }
            if w.guess { t = t.underline(true, pattern: .dot, color: C.warn) }
            out = i == 0 ? out + t : out + Text(" ") + t
        }
        return out
    }
}

struct FootCell: View {
    let f: FootUI
    var body: some View {
        VStack(spacing: 3) {
            Text(f.text).font(Fonts.verse(17)).lineLimit(2).minimumScaleFactor(0.7)
            Text("\u{200F}" + f.sym).font(.system(size: 14, weight: .medium, design: .monospaced)).foregroundStyle(f.bad ? C.bad : C.muted)
            if !f.exp.isEmpty {
                Text("المطلوب: \u{200F}" + f.exp).font(.system(size: 11)).foregroundStyle(C.bad)
            }
            Text(f.name).font(.caption.weight(.semibold)).foregroundStyle(f.bad ? C.bad : C.accent)
            if !f.note.isEmpty {
                Text(f.note).font(.system(size: 10)).foregroundStyle(C.muted).multilineTextAlignment(.center)
            }
        }
        .padding(.vertical, 8).padding(.horizontal, 4)
        .frame(maxWidth: .infinity)
        .background(f.bad ? C.badSoft : C.bg)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(f.bad ? C.bad.opacity(0.5) : C.line, lineWidth: 1))
    }
}

/// بطاقة القافية بين الأبيات
struct RhymeCard: View {
    let r: RhymeUI
    var body: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
                Text("القافية").font(Fonts.verse(24, bold: true)).foregroundStyle(C.accent)
                Text(r.detail).font(.subheadline).foregroundStyle(C.muted)
            }
            Spacer()
            Badge(text: r.badge, ok: r.ok)
        }
        .card()
    }
}
