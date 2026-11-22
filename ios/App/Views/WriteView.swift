// تبويب «اكتب لي»: يكتب الذكاء الاصطناعي الأبيات، ويزنها «وزن» بيتاً بيتاً، ويعيد المكسور للإصلاح حتى ثلاث مرات.
import SwiftUI

struct WriteView: View {
    @EnvironmentObject var app: AppState
    @ObservedObject private var core = CoreStatus.shared
    @State private var purposes: [String] = []
    @State private var meters: [MeterInfo] = []
    @State private var purpose = "مدح"
    @State private var other = ""
    @State private var name = ""
    @State private var details = ""
    @State private var count = 4
    @State private var meter = ""
    @State private var rawi = ""
    @State private var busy = false
    @State private var status = ""
    @State private var result: ComposeOutput?
    @State private var failure: AIFailure?
    @State private var hasKey = true
    @State private var autoIDs: Set<Int> = []

    private static let otherPurpose = "غرض آخر"

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if !hasKey {
                        HStack {
                            Text("هذه الميزة تحتاج مفتاح API.").font(.subheadline)
                            Button("أضفه من الإعدادات") { app.showSettings = true }.font(.subheadline.weight(.semibold))
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(C.accentSoft)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    form
                    if let f = failure {
                        ErrorBox(text: f.message)
                        DisclosureGroup("تفاصيل الخطأ") {
                            Text(f.details).font(.caption.monospaced()).textSelection(.enabled)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                        .font(.footnote)
                    }
                    if let r = result { PoemCard(res: r, autoIDs: autoIDs) { Task { await write() } } }
                }
                .padding(16)
                .readable()
            }
            .scrollDismissesKeyboard(.interactively)
            .background(C.bg.ignoresSafeArea())
            .navigationTitle("اكتب لي")
            .navigationBarTitleDisplayMode(.inline)
            .settingsButton()
        }
        .task {
            if purposes.isEmpty {
                purposes = await WaznCore.shared.purposes() + [Self.otherPurpose]
                meters = await WaznCore.shared.meters()
                if let f = purposes.first { purpose = f }
            }
            hasKey = await WaznCore.shared.hasKey()
        }
        .onChange(of: app.showSettings) { open in
            if !open { Task { hasKey = await WaznCore.shared.hasKey() } }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 12) {
            field("الغرض") {
                Picker("الغرض", selection: $purpose) {
                    ForEach(purposes, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
            }
            if purpose == Self.otherPurpose {
                field("اكتب الغرض") { TextField("مثل: اعتذار، وصف، فخر", text: $other).textFieldStyle(.roundedBorder) }
            }
            field("الاسم (اختياري)") { TextField("مثل: أبو محمد عبدالله", text: $name).textFieldStyle(.roundedBorder) }
            field("التفاصيل والصفات") {
                TextEditor(text: $details)
                    .frame(minHeight: 80)
                    .scrollContentBackground(.hidden)
                    .padding(6)
                    .background(C.bg)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(C.line, lineWidth: 1))
            }
            HStack(alignment: .top, spacing: 12) {
                field("عدد الأبيات") {
                    Picker("عدد الأبيات", selection: $count) {
                        ForEach(2...8, id: \.self) { Text($0.ar).tag($0) }
                    }
                    .pickerStyle(.menu)
                }
                field("البحر") {
                    Picker("البحر", selection: $meter) {
                        Text("اختر أنت").tag("")
                        ForEach(meters, id: \.name) { Text($0.name).tag($0.name) }
                    }
                    .pickerStyle(.menu)
                }
                field("الروي") {
                    TextField("ل", text: $rawi)
                        .textFieldStyle(.roundedBorder)
                        .frame(maxWidth: 70)
                        .onChange(of: rawi) { v in if v.count > 1 { rawi = String(v.suffix(1)) } }
                }
            }
            HStack(spacing: 10) {
                PrimaryButton(title: "اكتب", busy: busy, disabled: !core.ready) { Task { await write() } }
                if !status.isEmpty { Text(status).font(.footnote).foregroundStyle(C.muted) }
            }
            Text("يكتب الذكاء الاصطناعي الأبيات، ثم يزنها «وزن» بيتاً بيتاً، ويعيد المكسور للإصلاح حتى ثلاث مرات. يحتاج إنترنت.")
                .font(.footnote).foregroundStyle(C.muted)
        }
        .card(padding: 16)
    }

    private func field<V: View>(_ label: String, @ViewBuilder _ content: () -> V) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.footnote).foregroundStyle(C.muted)
            content()
        }
    }

    private func write() async {
        failure = nil
        guard await WaznCore.shared.hasKey() else { hasKey = false; return }
        var p = purpose
        if p == Self.otherPurpose { p = other.trimmingCharacters(in: .whitespaces).isEmpty ? "غرض عام" : other }
        let nm = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let dt = details.trimmingCharacters(in: .whitespacesAndNewlines)
        if nm.isEmpty && dt.isEmpty && p != "حكمة" { status = "اكتب الاسم أو بعض التفاصيل."; return }
        busy = true
        result = nil
        defer { busy = false; status = "" }
        let params = ComposeParams(purpose: p, name: nm, details: dt, count: count,
                                   meter: meter.isEmpty ? nil : meter,
                                   rawi: rawi.trimmingCharacters(in: .whitespaces).isEmpty ? nil : rawi)
        do {
            let r = try await WaznCore.shared.compose(params) { m in status = m }
            var auto: Set<Int> = []
            if let s = try? await WaznCore.shared.settings(), s.autoFix {
                let limit = await WaznCore.shared.autoFixLimit()
                auto = Set(r.verses.filter { !$0.ok }.compactMap { $0.result?.id }.prefix(limit))
            }
            autoIDs = auto
            result = r
        } catch let e as AIFailure {
            failure = e
        } catch {
            failure = AIFailure(message: "حدث خطأ: " + error.localizedDescription, diag: "", raw: "")
        }
    }
}

/// القصيدة المؤلفة: الأبيات (المكسور منها بالأحمر)، والنسخ، والتقطيع
struct PoemCard: View {
    let res: ComposeOutput
    let autoIDs: Set<Int>
    var again: () -> Void
    @State private var showCuts = false

    private var okCount: Int { res.verses.filter(\.ok).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(res.meter.isEmpty ? "—" : res.meter).font(Fonts.verse(25, bold: true)).foregroundStyle(C.accent)
                    if !res.rawi.isEmpty { Text("الروي: \(res.rawi)").font(.subheadline).foregroundStyle(C.muted) }
                }
                Spacer()
                Badge(text: okCount == res.verses.count ? "موزونة كلها ✓" : "\(okCount.ar) من \(res.verses.count.ar) موزونة", ok: okCount == res.verses.count)
            }
            VStack(alignment: .leading, spacing: 14) {
                ForEach(Array(res.verses.enumerated()), id: \.offset) { _, v in
                    Bayt(sadr: v.sadr, ajz: v.ajz, bad: !v.ok)
                }
            }
            Text(meta).font(.footnote).foregroundStyle(C.muted)
            FlowLayout(spacing: 8) {
                CopyButton(text: res.verses.filter(\.ok).map { "\($0.sadr)    \($0.ajz)" }.joined(separator: "\n"), title: "نسخ الأبيات")
                SmallButton(title: "اكتب غيرها", systemImage: "arrow.clockwise", action: again)
            }
            ForEach(Array(res.verses.enumerated()), id: \.offset) { _, v in
                if !v.ok, let r = v.result {
                    ResultCard(r: r, rawi: res.rawi, haraka: res.haraka, autoFix: autoIDs.contains(r.id))
                }
            }
            DisclosureGroup("التقطيع والتفعيلات", isExpanded: $showCuts) {
                VStack(spacing: 10) {
                    ForEach(Array(res.verses.enumerated()), id: \.offset) { _, v in
                        if v.ok, let r = v.result { ResultCard(r: r, rawi: res.rawi, haraka: res.haraka) }
                    }
                }
                .padding(.top, 8)
            }
            .font(.subheadline)
        }
        .card()
    }

    private var meta: String {
        var s = res.rounds == 0 ? "استقامت من أول مرة." :
            "أُصلح بعد \(res.rounds == 1 ? "محاولة واحدة" : res.rounds == 2 ? "محاولتين" : "\(res.rounds.ar) محاولات")."
        if okCount < res.verses.count { s += " الأبيات بالأحمر ما استقام وزنها، ويمكنك أن تطلب غيرها." }
        return s
    }
}
