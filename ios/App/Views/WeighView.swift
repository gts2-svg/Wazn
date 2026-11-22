// تبويب «زِن»: يكتب المستخدم البيت أو الأبيات، فيُعطى البحر والتقطيع وموضع الكسر ووجهه، والقافية بين الأبيات.
import SwiftUI

struct WeighView: View {
    @EnvironmentObject var app: AppState
    @ObservedObject private var core = CoreStatus.shared
    @State private var text = UserDefaults.standard.string(forKey: "wazn.last") ?? ""
    @State private var output: WeighOutput?
    @State private var autoIDs: Set<Int> = []
    @State private var busy = false
    @State private var error: String?
    @State private var sampleIdx = 0
    @State private var showMeters = false
    @FocusState private var focused: Bool

    static let samples = [
        "قفا نبكِ من ذكرى حبيبٍ ومنزلِ * بسِقطِ اللوى بين الدَّخولِ فحوملِ",
        "الخيلُ والليلُ والبيداءُ تعرفني * والسيفُ والرمحُ والقرطاسُ والقلمُ",
        "إذا غامرتَ في شرفٍ مرومِ * فلا تقنعْ بما دونَ النجومِ",
        "وإذا أتتكَ مذمّتي من ناقصٍ * فهي الشهادةُ لي بأنّي كاملُ",
        "صاحِ هذي قبورُنا تملأُ الرحبَ * فأينَ القبورُ من عهدِ عادِ",
        "وللهِ في كلِّ تحريكةٍ * وتسكينةٍ أبداً شاهدُ",
        "ليسَ الغريبُ غريبَ الشامِ واليمنِ * إنّ الغريبَ غريبُ اللحدِ والكفنِ",
        "الحمدُ للهِ العليِّ الأجللِ * الواسعِ الفضلِ الوهوبِ المجزلِ",
    ]

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        BrandHeader()
                        editor
                        actions
                        Text("بيت في كل سطر، وافصل الشطرين بـ * أو بثلاث مسافات، أو اكتب كل شطر في سطر. وكلما شكّلت الكلمات كان الوزن أدق.")
                            .font(.footnote).foregroundStyle(C.muted)
                        if let e = error { ErrorBox(text: e) }
                        if let o = output {
                            Color.clear.frame(height: 0).id("results")
                            if let rh = o.rhyme { RhymeCard(r: rh) }
                            ForEach(Array(o.items.enumerated()), id: \.element.key) { _, r in
                                ResultCard(r: r, rawi: o.rhyme?.rawi ?? "", haraka: o.rhyme?.haraka ?? "", autoFix: autoIDs.contains(r.id))
                            }
                        }
                    }
                    .padding(16)
                    .readable()
                }
                .scrollDismissesKeyboard(.interactively)
                .background(C.bg.ignoresSafeArea())
                .onChange(of: output?.items.first?.key) { _ in
                    withAnimation { proxy.scrollTo("results", anchor: .top) }
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .settingsButton()
            .sheet(isPresented: $showMeters) {
                MetersView { key in
                    showMeters = false
                    text = key
                    Task { await run() }
                }
                .environment(\.layoutDirection, .rightToLeft)
            }
        }
        .onChange(of: app.weighRequest) { req in
            guard let req else { return }
            text = req.text
            app.weighRequest = nil
            Task { await run() }
        }
    }

    private var editor: some View {
        ZStack(alignment: .topLeading) {
            if text.isEmpty {
                Text("اكتب البيت هنا، وافصل الشطرين بنجمة *\nمثال: قفا نبكِ من ذكرى حبيبٍ ومنزلِ * بسقطِ اللوى بين الدخولِ فحوملِ")
                    .font(Fonts.verse(19))
                    .foregroundStyle(C.muted.opacity(0.7))
                    .padding(.horizontal, 14).padding(.vertical, 14)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $text)
                .font(Fonts.verse(21))
                .focused($focused)
                .scrollContentBackground(.hidden)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .padding(.horizontal, 8).padding(.vertical, 6)
                .frame(minHeight: 130)
        }
        .background(C.card)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(focused ? C.accent : C.line, lineWidth: focused ? 2 : 1))
    }

    private var actions: some View {
        FlowLayout(spacing: 8) {
            PrimaryButton(title: "زِنْ", busy: busy, disabled: !core.ready || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) {
                Task { await run() }
            }
            SmallButton(title: "مثال", systemImage: "text.quote") {
                text = Self.samples[sampleIdx % Self.samples.count]
                sampleIdx += 1
                Task { await run() }
            }
            SmallButton(title: "البحور", systemImage: "list.bullet.rectangle") { showMeters = true }
            SmallButton(title: "مسح", systemImage: "xmark") {
                text = ""; output = nil; error = nil; focused = true
            }
            if let e = core.error {
                Text(e).font(.footnote).foregroundStyle(C.bad)
            } else if !core.ready {
                HStack(spacing: 6) { ProgressView(); Text("يحمّل القاموس…").font(.footnote).foregroundStyle(C.muted) }
                    .padding(.vertical, 6)
            }
        }
    }

    private func run() async {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { output = nil; return }
        focused = false
        busy = true
        error = nil
        defer { busy = false }
        do {
            let o = try await WaznCore.shared.weigh(t)
            // التعديل المقترح تلقائياً لأول الأبيات المكسورة، إن وُجد المفتاح وكان الخيار مفعّلاً
            var auto: Set<Int> = []
            if let s = try? await WaznCore.shared.settings(), !s.key.isEmpty, s.autoFix {
                let limit = await WaznCore.shared.autoFixLimit()
                auto = Set(o.items.filter { $0.needsFix == true }.prefix(limit).map(\.id))
            }
            autoIDs = auto
            output = o
            UserDefaults.standard.set(t, forKey: "wazn.last")
        } catch {
            self.error = "تعذّر الوزن: " + error.localizedDescription
        }
    }
}

/// رأس التطبيق: الشعار والاسم ورقم النسخة
struct BrandHeader: View {
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "scalemass")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(C.accent)
                .frame(width: 52, height: 52)
                .background(C.accentSoft)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                Text("وزن").font(Fonts.verse(36, bold: true)).foregroundStyle(C.ink)
                Text("ميزان الشعر العربي الفصيح").font(.subheadline).foregroundStyle(C.muted)
            }
            Spacer()
            Text("النسخة \(AppInfo.version)")
                .font(.caption.weight(.medium))
                .foregroundStyle(C.muted)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(C.card)
                .clipShape(Capsule())
                .overlay(Capsule().stroke(C.line, lineWidth: 1))
        }
    }
}
