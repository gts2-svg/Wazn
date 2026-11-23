// تبويب «انظم»: «شكل القصيدة». تمرّر الأغراض فتتلوّن الشاشة، وترى إيقاع البحر ينبض، وتسحب فتطول القصيدة أو تقصر،
// ثم «انظم»: يكتب الذكاء الاصطناعي ويزن «وزن» ويُصلح المكسور، ويكمل ولو خرجت من التطبيق.
import SwiftUI
import UIKit

struct PurposeStyle: Identifiable {
    let name: String
    let c1: Color
    let c2: Color
    let accent: Color
    let sample: String
    let role: String      // تسمية خانة الاسم
    /// لون النص والأزرار: الفاتح على الداكن، والعميق على الورقي
    let tint: Color
    var id: String { name }

    static let all: [PurposeStyle] = [
        .init(name: "مدح", c1: Color(hex: "#b8862d"), c2: Color(hex: "#5e3d0c"), accent: Color(hex: "#e8c36a"), sample: "على قدرِ أهلِ العزمِ تأتي العزائمُ", role: "الممدوح", tint: Color(light: "#8b611c", dark: "#e8c36a")),
        .init(name: "تهنئة", c1: Color(hex: "#2f6f9a"), c2: Color(hex: "#10293b"), accent: Color(hex: "#8cc8f0"), sample: "لكلِّ امرئٍ من دهرِه ما تعوّدا", role: "المهنَّأ", tint: Color(light: "#1f4c6a", dark: "#8cc8f0")),
        .init(name: "رثاء", c1: Color(hex: "#4a5a78"), c2: Color(hex: "#1c2333"), accent: Color(hex: "#a9b8d8"), sample: "لكلِّ شيءٍ إذا ما تمَّ نقصانُ", role: "المرثيّ", tint: Color(light: "#333e55", dark: "#a9b8d8")),
        .init(name: "شكر", c1: Color(hex: "#6d5a9e"), c2: Color(hex: "#251c3d"), accent: Color(hex: "#c4b2f0"), sample: "مَن يفعلِ الخيرَ لا يعدمْ جوازيَهُ", role: "المشكور", tint: Color(light: "#493b6d", dark: "#c4b2f0")),
        .init(name: "حكمة", c1: Color(hex: "#17806b"), c2: Color(hex: "#0b3a31"), accent: Color(hex: "#6fd6bb"), sample: "ومَن يجعلِ المعروفَ في غيرِ أهلِه", role: "الموضوع", tint: Color(light: "#115d4e", dark: "#6fd6bb")),
        .init(name: "غزل عفيف", c1: Color(hex: "#a84868"), c2: Color(hex: "#45182a"), accent: Color(hex: "#f0a3bb"), sample: "يقولونَ جاهدْ يا جميلُ بغزوةٍ", role: "المقصود", tint: Color(light: "#763049", dark: "#f0a3bb")),
        .init(name: "هجاء", c1: Color(hex: "#a3382c"), c2: Color(hex: "#40120d"), accent: Color(hex: "#f08a76"), sample: "دعِ المكارمَ لا ترحلْ لبُغيتِها", role: "المهجوّ", tint: Color(light: "#71251c", dark: "#f08a76")),
        .init(name: "غرض آخر", c1: Color(hex: "#4d5b57"), c2: Color(hex: "#1a2220"), accent: Color(hex: "#cfd8d4"), sample: "اكتب الغرض بنفسك", role: "المقصود", tint: Color(light: "#333e3b", dark: "#cfd8d4")),
    ]
}

enum Rhythm {
    /// صورة التفعيلات: / متحرك، ه ساكن
    static let feet: [String: String] = [
        "فعولن": "//ه/ه", "مفاعيلن": "//ه/ه/ه", "مفاعلن": "//ه//ه", "فاعلاتن": "/ه//ه/ه", "فاعلن": "/ه//ه",
        "مستفعلن": "/ه/ه//ه", "فعلن": "///ه", "مفاعلتن": "//ه///ه", "متفاعلن": "///ه//ه", "مفعولات": "/ه/ه/ه/",
        "مفتعلن": "/ه///ه", "مفاعيل": "//ه/ه/",
    ]
    /// أعمدة الموجة: 0 فاصل بين التفعيلات، 1 حركة قصيرة، 2 سبب (متحرك فساكن)
    static func bars(_ feetText: String) -> [Int] {
        var t = String(feetText.unicodeScalars.filter { !(0x064B...0x0652).contains($0.value) })
        t = t.replacingOccurrences(of: "مستفع لن", with: "مستفعلن").replacingOccurrences(of: "فاع لاتن", with: "فاعلاتن")
        var out: [Int] = []
        let parts = t.split(separator: " ").map(String.init)
        for (j, f) in parts.enumerated() {
            guard let p = feet[f] else { continue }
            let cs = Array(p)
            for (i, c) in cs.enumerated() where c == "/" {
                out.append(i + 1 < cs.count && cs[i + 1] == "ه" ? 2 : 1)
            }
            if j < parts.count - 1 { out.append(0) }
        }
        return out
    }
    static let free: [Int] = [1, 2, 1, 2, 2, 0, 1, 2, 1, 2, 0, 2, 1, 2, 2, 0, 1, 2, 1, 2]
}

private let arabicCount = ["", "بيت", "بيتان", "ثلاثة أبيات", "أربعة أبيات", "خمسة أبيات", "ستة أبيات", "سبعة أبيات", "ثمانية أبيات", "تسعة أبيات", "عشرة أبيات"]
private func countWord(_ n: Int) -> String { n <= 10 ? arabicCount[n] : "\(n.ar) بيتاً" }

struct ComposeView: View {
    @EnvironmentObject var app: AppState
    @ObservedObject private var runner = ComposeRunner.shared
    @ObservedObject private var core = CoreStatus.shared
    @State private var pIdx = 0
    @State private var meters: [MeterInfo] = []
    @State private var mIdx = 0            // 0 = يختار الشاعر
    @State private var count = 6
    @State private var rawi = ""
    @State private var name = ""
    @State private var details = ""
    @State private var custom = ""
    @State private var showWho = false
    @State private var showRawi = false
    @State private var needKey = false
    @State private var hint = ""

    private var style: PurposeStyle { PurposeStyle.all[pIdx] }
    private var purposeName: String { style.name == "غرض آخر" ? (custom.isEmpty ? "غرض آخر" : custom) : style.name }
    private var meter: MeterInfo? { mIdx == 0 || meters.isEmpty ? nil : meters[mIdx - 1] }

    var body: some View {
        NavigationStack {
            ZStack {
                background
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(alignment: .leading, spacing: 14) {
                            header
                            purposeRail(proxy)
                            meterCard
                            shapeCard
                            HStack(spacing: 12) { rawiCard; whoCard }
                            if needKey { keyNote }
                            if !hint.isEmpty { Text(hint).font(.subheadline).foregroundStyle(style.tint) }
                            goButton
                            Color.clear.frame(height: 1).id("out")
                            output
                        }
                        .padding(.horizontal, 16)
                        .padding(.bottom, 30)
                        .readable()
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onChange(of: runner.isRunning) { r in
                        if r { withAnimation { proxy.scrollTo("out", anchor: .top) } }
                    }
                    .onChange(of: runner.revision) { _ in
                        withAnimation { proxy.scrollTo("out", anchor: .top) }
                    }
                }
            }
            .toolbarBackground(.hidden, for: .navigationBar)
            .navigationBarTitleDisplayMode(.inline)
            .settingsButton()
            .sheet(isPresented: $showWho) {
                WhoSheet(role: style.role, isOther: style.name == "غرض آخر", name: $name, details: $details, custom: $custom, accent: style.tint)
                    .environment(\.layoutDirection, .rightToLeft)
                    .presentationDetents([.medium, .large])
            }
            .sheet(isPresented: $showRawi) {
                RawiSheet(rawi: $rawi, accent: style.tint)
                    .environment(\.layoutDirection, .rightToLeft)
                    .presentationDetents([.medium, .large])
            }
        }
        .task {
            if meters.isEmpty { meters = await WaznCore.shared.meters() }
            needKey = !(await WaznCore.shared.hasKey())
        }
        .onChange(of: app.showSettings) { open in
            if !open { Task { needKey = !(await WaznCore.shared.hasKey()) } }
        }
    }

    // MARK: - الخلفية والرأس

    private var background: some View {
        Backdrop(glow: style.tint)
            .animation(.easeInOut(duration: 0.7), value: pIdx)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("قصيدة في \(purposeName)")
                .font(Fonts.verse(44, bold: true))
                .foregroundStyle(style.tint)
                .lineLimit(1).minimumScaleFactor(0.6)
                .animation(.easeInOut(duration: 0.4), value: pIdx)
            Text("مرّر الأغراض، واسحب لتتشكّل القصيدة").font(.subheadline).foregroundStyle(C.ink.opacity(0.5))
        }
        .padding(.top, 4)
    }

    private func purposeRail(_ proxy: ScrollViewProxy) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(Array(PurposeStyle.all.enumerated()), id: \.offset) { i, p in
                    PurposeCard(p: p, on: i == pIdx)
                        .id("p\(i)")
                        .onTapGesture {
                            withAnimation(.spring(response: 0.4, dampingFraction: 0.8)) { pIdx = i }
                            withAnimation { proxy.scrollTo("p\(i)", anchor: .center) }
                            hint = ""
                            if p.name == "غرض آخر" && custom.isEmpty { showWho = true }
                        }
                }
            }
            .padding(.vertical, 10)
            .padding(.horizontal, 16)
        }
        .frame(height: 196)
        .padding(.horizontal, -16)
    }

    // MARK: - البحر

    private var meterCard: some View {
        Glass {
            VStack(spacing: 10) {
                HStack {
                    Text("البحر").font(.footnote).foregroundStyle(C.ink.opacity(0.6))
                    Spacer()
                    Text(mIdx == 0 ? "يختار الشاعر" : "\(mIdx.ar) من \(meters.count.ar)").font(.footnote).foregroundStyle(C.ink.opacity(0.6))
                }
                HStack(spacing: 10) {
                    RoundIcon(system: "chevron.right") { step(-1) }
                    VStack(spacing: 2) {
                        Text(meter?.name ?? "يختار الشاعر")
                            .font(Fonts.verse(32, bold: true)).foregroundStyle(style.tint)
                            .contentTransition(.opacity)
                        Text(meter?.key ?? "البحر الأنسب للغرض من بحور الخليل")
                            .font(Fonts.verse(17)).foregroundStyle(C.ink.opacity(0.8))
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                    .frame(maxWidth: .infinity)
                    RoundIcon(system: "chevron.left") { step(1) }
                }
                RhythmWave(bars: meter.map { Rhythm.bars($0.feet) } ?? Rhythm.free, accent: style.tint, calm: meter == nil)
                    .frame(height: 50)
                if let m = meter {
                    Text(m.feet).font(.footnote).foregroundStyle(C.ink.opacity(0.5))
                }
            }
        }
        .gesture(DragGesture(minimumDistance: 30).onEnded { v in
            // في اتجاه اليمين لليسار: السحب يساراً إلى البحر التالي
            if v.translation.width < -40 { step(1) } else if v.translation.width > 40 { step(-1) }
        })
    }

    private func step(_ d: Int) {
        let n = meters.count + 1
        withAnimation(.easeInOut(duration: 0.25)) { mIdx = (mIdx + d + n) % n }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    // MARK: - شكل القصيدة

    private var shapeCard: some View {
        Glass {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("شكل القصيدة").font(.footnote).foregroundStyle(C.ink.opacity(0.6))
                    Spacer()
                    Text(countWord(count)).font(Fonts.verse(22, bold: true)).foregroundStyle(C.ink)
                }
                VStack(spacing: 9) {
                    ForEach(0..<count, id: \.self) { i in
                        HStack(spacing: 16) {
                            Capsule().fill(C.ink.opacity(0.12)).frame(height: 11)
                                .padding(.leading, CGFloat((i * 37) % 22))
                            Capsule().fill(C.ink.opacity(0.12)).frame(height: 11)
                                .padding(.trailing, CGFloat((i * 53) % 26))
                        }
                        .transition(.asymmetric(insertion: .scale(scale: 0.6, anchor: .center).combined(with: .opacity), removal: .opacity))
                    }
                }
                .animation(.spring(response: 0.35, dampingFraction: 0.8), value: count)
                Slider(value: Binding(get: { Double(count) }, set: { v in
                    let n = Int(v.rounded())
                    if n != count { count = n; UISelectionFeedbackGenerator().selectionChanged() }
                }), in: 2...20, step: 1)
                .tint(style.tint)
            }
        }
    }

    // MARK: - الروي والمقصود

    private var rawiCard: some View {
        Button { showRawi = true } label: {
            Glass(padding: 14) {
                HStack(spacing: 12) {
                    Text(rawi.isEmpty ? "؟" : (rawi == "ا" ? "أ" : rawi))
                        .font(Fonts.verse(28, bold: true))
                        .foregroundStyle(C.onAccent)
                        .frame(width: 50, height: 50)
                        .background(Circle().fill(style.tint))
                    VStack(alignment: .leading, spacing: 2) {
                        Text("الروي").font(Fonts.verse(20, bold: true)).foregroundStyle(C.ink)
                        Text(rawi.isEmpty ? "يختاره الشاعر" : "المس لتغييره").font(.caption).foregroundStyle(C.ink.opacity(0.5))
                    }
                    Spacer(minLength: 0)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var whoCard: some View {
        Button { showWho = true } label: {
            Glass(padding: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(name.isEmpty ? style.role : name).font(Fonts.verse(20, bold: true)).foregroundStyle(C.ink).lineLimit(1)
                    Text(details.isEmpty ? "المس لتكتب الاسم والتفاصيل" : details).font(.caption).foregroundStyle(C.ink.opacity(0.5)).lineLimit(2)
                }
                .frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
    }

    private var keyNote: some View {
        HStack {
            Text("النظم يحتاج مفتاح API.").font(.subheadline).foregroundStyle(C.ink.opacity(0.8))
            Button("أضفه") { app.showSettings = true }.font(.subheadline.weight(.semibold)).foregroundStyle(style.tint)
        }
    }

    // MARK: - انظم

    private var goButton: some View {
        Button(action: go) {
            HStack(spacing: 10) {
                if runner.isRunning { ProgressView().tint(C.onAccent) }
                Text(runner.isRunning ? "ينظم…" : "انظم").font(Fonts.verse(28, bold: true))
            }
            .foregroundStyle(C.onAccent)
            .frame(maxWidth: .infinity, minHeight: 60)
            .background(Capsule().fill(LinearGradient(colors: [style.tint, style.tint.opacity(0.7)], startPoint: .trailing, endPoint: .leading)))
            .shadow(color: style.tint.opacity(0.45), radius: 16, y: 8)
        }
        .buttonStyle(.plain)
        .disabled(runner.isRunning || !core.ready)
        .padding(.top, 6)
    }

    private func go() {
        hint = ""
        Task {
            guard await WaznCore.shared.hasKey() else { needKey = true; return }
            needKey = false
            let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
            let d = details.trimmingCharacters(in: .whitespacesAndNewlines)
            if style.name == "غرض آخر" && custom.trimmingCharacters(in: .whitespaces).isEmpty { showWho = true; return }
            if n.isEmpty && d.isEmpty && style.name != "حكمة" {
                hint = "اكتب \(style.role) أو بعض التفاصيل أولاً."
                showWho = true
                return
            }
            let p = ComposeParams(purpose: purposeName, name: n, details: d, count: count,
                                  meter: meter?.name, rawi: rawi.isEmpty ? nil : rawi)
            runner.start(p)
        }
    }

    @ViewBuilder private var output: some View {
        switch runner.phase {
        case .idle:
            EmptyView()
        case .running:
            Glass {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        ProgressView().tint(style.tint)
                        Text(runner.status).font(.subheadline).foregroundStyle(C.ink.opacity(0.8))
                    }
                    Text("لك أن تخرج من التطبيق؛ يكمل النظم وينبّهك حين تجهز القصيدة.")
                        .font(.footnote).foregroundStyle(C.ink.opacity(0.5))
                    VStack(spacing: 14) {
                        ForEach(0..<min(count, 8), id: \.self) { i in
                            ShimmerLine(delay: Double(i) * 0.15)
                        }
                    }
                }
            }
        case .done(let r):
            PoemOut(res: r, accent: style.tint, autoIDs: runner.autoIDs,
                    again: { if let p = runner.lastParams { runner.start(p) } },
                    clear: { runner.clear() })
        case .failed(let e):
            VStack(alignment: .leading, spacing: 8) {
                ErrorBox(text: e.message)
                DisclosureGroup("تفاصيل الخطأ") {
                    Text(e.details).font(.caption.monospaced()).textSelection(.enabled)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .font(.footnote)
            }
        }
    }
}

// MARK: - القطع

/// بطاقة زجاجية
struct Glass<Content: View>: View {
    var padding: CGFloat = 18
    @ViewBuilder var content: () -> Content
    var body: some View {
        content()
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(C.card.opacity(0.94), in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(C.line, lineWidth: 1))
    }
}

struct RoundIcon: View {
    let system: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(C.ink)
                .frame(width: 40, height: 40)
                .background(Circle().fill(C.ink.opacity(0.08)))
                .overlay(Circle().stroke(C.ink.opacity(0.15), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

struct PurposeCard: View {
    let p: PurposeStyle
    let on: Bool
    var body: some View {
        ZStack(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(LinearGradient(colors: [p.c1, p.c2], startPoint: .topTrailing, endPoint: .bottomLeading))
            Text(String(p.name.prefix(1)))
                .font(Fonts.verse(120, bold: true))
                .foregroundStyle(.white.opacity(0.08))
                .offset(x: -18, y: -30)
                .frame(maxWidth: .infinity, alignment: .trailing)
            VStack(alignment: .leading, spacing: 0) {
                Text(p.name).font(Fonts.verse(25, bold: true)).foregroundStyle(.white).lineLimit(1).minimumScaleFactor(0.7)
                    .padding(.top, 24)
                Spacer(minLength: 4)
                Text(p.sample).font(Fonts.verse(13)).foregroundStyle(.white.opacity(0.8))
                    .lineLimit(1).minimumScaleFactor(0.75)
                    .padding(.bottom, 4)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
        }
        .frame(width: 136, height: 164)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).stroke(.white.opacity(on ? 0.45 : 0.12), lineWidth: on ? 1.5 : 1))
        .scaleEffect(on ? 1 : 0.94)
        .offset(y: on ? -4 : 0)
        .opacity(on ? 1 : 0.6)
        .shadow(color: p.c1.opacity(on ? 0.55 : 0), radius: 14, y: 10)
    }
}

/// إيقاع البحر: أعمدة قصيرة للمتحرك وطويلة للسبب، وضوء يمرّ عليها
struct RhythmWave: View {
    static func indices(_ bars: [Int]) -> [Int] {
        var k = -1
        var out: [Int] = []
        for b in bars {
            if b == 0 { out.append(-1) } else { k += 1; out.append(k) }
        }
        return out
    }
    let bars: [Int]
    let accent: Color
    var calm = false

    var body: some View {
        let nBars = bars.filter { $0 != 0 }.count
        let idx = Self.indices(bars)
        TimelineView(.periodic(from: .now, by: 0.21)) { ctx in
            let step = Int(ctx.date.timeIntervalSinceReferenceDate / 0.21)
            let hit = calm ? -1 : step % max(1, nBars + 3)
            HStack(spacing: 4) {
                ForEach(Array(bars.enumerated()), id: \.offset) { i, b in
                    if b == 0 {
                        Color.clear.frame(width: 9, height: 4)
                    } else {
                        let lit = idx[i] == hit
                        Capsule()
                            .fill(accent.opacity(lit ? 1 : (calm ? 0.25 : 0.35)))
                            .frame(width: 7, height: b == 2 ? 38 : 14)
                            .shadow(color: lit ? accent : .clear, radius: 8)
                            .animation(.easeOut(duration: 0.18), value: lit)
                    }
                }
            }
            .frame(maxWidth: .infinity)
        }
    }
}

struct ShimmerLine: View {
    let delay: Double
    @State private var on = false
    var body: some View {
        HStack(spacing: 16) {
            Capsule().fill(C.ink.opacity(on ? 0.2 : 0.07)).frame(height: 12)
            Capsule().fill(C.ink.opacity(on ? 0.2 : 0.07)).frame(height: 12)
        }
        .onAppear {
            withAnimation(.easeInOut(duration: 0.9).repeatForever().delay(delay)) { on = true }
        }
    }
}

/// القصيدة المنظومة: الأبيات وصنعة كل بيت، وحكم الناقد، والصياغات الأخرى، وبديل لأي بيت
struct PoemOut: View {
    let res: ComposeOutput
    let accent: Color
    let autoIDs: Set<Int>
    var again: () -> Void
    var clear: () -> Void
    @ObservedObject private var runner = ComposeRunner.shared
    @State private var shown = 0
    @State private var showCuts = false
    @State private var openCraft: Set<Int> = []
    @State private var altSel = 0

    private var okCount: Int { res.verses.filter(\.ok).count }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Glass {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(res.meter.isEmpty ? "—" : res.meter).font(Fonts.verse(28, bold: true)).foregroundStyle(accent)
                            if !res.rawi.isEmpty { Text("الروي: \(res.rawi)").font(.footnote).foregroundStyle(C.muted) }
                        }
                        Spacer()
                        Text(okCount == res.verses.count ? "موزونة كلها ✓" : "\(okCount.ar) من \(res.verses.count.ar) موزونة")
                            .font(.footnote.weight(.semibold))
                            .padding(.horizontal, 10).padding(.vertical, 4)
                            .foregroundStyle(okCount == res.verses.count ? C.ok : C.bad)
                            .background(Capsule().fill(C.ink.opacity(0.06)))
                    }
                    ForEach(Array(res.verses.enumerated()), id: \.offset) { i, v in
                        verseRow(i, v)
                            .opacity(i < shown ? 1 : 0)
                            .offset(y: i < shown ? 0 : 8)
                        if i < res.verses.count - 1 { Divider().overlay(C.line) }
                    }
                    if let e = runner.regenError {
                        Text(e.message).font(.footnote).foregroundStyle(C.bad)
                    }
                    if let v = res.verdict, !v.isEmpty {
                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "text.magnifyingglass").foregroundStyle(accent)
                            Text("رأي الناقد: " + v).font(.subheadline).foregroundStyle(C.muted)
                        }
                    }
                    Text(meta).font(.footnote).foregroundStyle(C.muted)
                    FlowLayout(spacing: 8) {
                        CopyButton(text: res.verses.filter(\.ok).map { "\($0.sadr)    \($0.ajz)" }.joined(separator: "\n"), title: "نسخ القصيدة")
                        SmallButton(title: "انظم غيرها", systemImage: "arrow.clockwise", action: again)
                        SmallButton(title: "مسح", systemImage: "xmark", action: clear)
                    }
                }
            }
            if let alts = res.alternatives, !alts.isEmpty { alternatives(alts) }
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
            .tint(accent)
        }
        .onAppear {
            reveal()
            #if DEBUG
            if Shot.name == "craft" { openCraft = [0, 1] }
            #endif
        }
        .onChange(of: res.verses.first?.sadr) { _ in shown = 0; openCraft = []; altSel = 0; reveal() }
    }

    @ViewBuilder private func verseRow(_ i: Int, _ v: ComposedVerse) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(v.sadr).frame(maxWidth: .infinity, alignment: .leading)
                Text(v.ajz).frame(maxWidth: .infinity, alignment: .trailing)
            }
            .font(Fonts.verse(22))
            .foregroundStyle(v.ok ? C.ink : C.bad)
            .lineSpacing(4)
            .textSelection(.enabled)
            .padding(.vertical, 2)
            HStack(spacing: 16) {
                if let c = v.craft, !c.isEmpty {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if openCraft.contains(i) { openCraft.remove(i) } else { openCraft.insert(i) }
                        }
                    } label: {
                        Label("صنعة البيت", systemImage: openCraft.contains(i) ? "chevron.up" : "sparkles")
                    }
                }
                Spacer(minLength: 0)
                if runner.regenIndex == i {
                    HStack(spacing: 6) {
                        ProgressView().controlSize(.small)
                        Text(runner.regenStatus).lineLimit(1)
                    }
                    .foregroundStyle(C.muted)
                } else {
                    Button { runner.regenerate(i) } label: {
                        Label("بديل لهذا البيت", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(runner.regenIndex != nil)
                }
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(accent)
            .buttonStyle(.plain)
            if openCraft.contains(i), let c = v.craft, !c.isEmpty {
                Text(c)
                    .font(.subheadline)
                    .foregroundStyle(C.ink.opacity(0.85))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(accent.opacity(0.12)))
                    .transition(.opacity)
            }
        }
    }

    private func alternatives(_ alts: [AltDraft]) -> some View {
        let sel = min(altSel, alts.count - 1)
        let a = alts[sel]
        return Glass {
            VStack(alignment: .leading, spacing: 12) {
                Text("صياغات أخرى لم يخترها الناقد").font(Fonts.verse(20, bold: true)).foregroundStyle(C.ink)
                Text("قد يعجبك ما لم يعجبه؛ اعتمد أيّها شئت.").font(.footnote).foregroundStyle(C.muted)
                HStack(spacing: 8) {
                    ForEach(Array(alts.enumerated()), id: \.offset) { k, x in
                        Chip(title: "الصياغة \(x.number.ar)", on: k == sel) { withAnimation { altSel = k } }
                    }
                }
                ForEach(Array(a.verses.enumerated()), id: \.offset) { j, v in
                    VStack(alignment: .leading, spacing: 2) {
                        Text(v.sadr).frame(maxWidth: .infinity, alignment: .leading)
                        Text(v.ajz).frame(maxWidth: .infinity, alignment: .trailing)
                    }
                    .font(Fonts.verse(20))
                    .foregroundStyle(v.ok ? C.ink : C.bad)
                    .textSelection(.enabled)
                    if j < a.verses.count - 1 { Divider().overlay(C.line) }
                }
                let okA = a.verses.filter(\.ok).count
                Text(okA == a.verses.count ? "موزونة كلها" : "\(okA.ar) من \(a.verses.count.ar) موزونة؛ ما لم يستقم بالأحمر")
                    .font(.footnote).foregroundStyle(C.muted)
                SmallButton(title: "اعتمد هذه الصياغة", systemImage: "checkmark") {
                    withAnimation { runner.adopt(a) }
                }
                .disabled(runner.regenIndex != nil)
            }
        }
    }

    private func reveal() {
        for i in 0..<res.verses.count {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.25 + Double(i) * 0.35) {
                withAnimation(.easeOut(duration: 0.6)) { shown = max(shown, i + 1) }
            }
        }
    }

    private var meta: String {
        var s = res.rounds == 0 ? "استقام وزنها من أول مرة." :
            "أُعيد نظم المكسور \(res.rounds == 1 ? "مرة واحدة" : res.rounds == 2 ? "مرتين" : "\(res.rounds.ar) مرات")."
        if okCount < res.verses.count { s += " الأبيات الحمراء لم يستقم وزنها؛ اطلب لها بديلاً." }
        return s
    }
}

/// المقصود بالقصيدة وتفاصيله
struct WhoSheet: View {
    let role: String
    let isOther: Bool
    @Binding var name: String
    @Binding var details: String
    @Binding var custom: String
    let accent: Color
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                if isOther {
                    Section("الغرض") { TextField("مثل: اعتذار، وصف، فخر، عتاب", text: $custom) }
                }
                Section(role) { TextField("مثل: أبو محمد عبدالله", text: $name) }
                Section("الخصال والتفاصيل") {
                    TextEditor(text: $details).frame(minHeight: 120)
                }
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("عمّن تكون القصيدة؟")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() }.tint(accent) }
            }
            .keyboardDone()
        }
    }
}

/// اختيار الروي: كتابةً أو ضغطاً
struct RawiSheet: View {
    @Binding var rawi: String
    let accent: Color
    @Environment(\.dismiss) private var dismiss
    @State private var typed = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    TextField("اكتب الحرف", text: $typed)
                        .font(Fonts.verse(26, bold: true))
                        .multilineTextAlignment(.center)
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 14).fill(C.ink.opacity(0.06)))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(C.ink.opacity(0.15)))
                        .onChange(of: typed) { v in
                            if let c = v.last(where: { ch in ch.unicodeScalars.first.map { (0x0621...0x064A).contains($0.value) } ?? false }) {
                                rawi = Ar.letterOf(c)
                                typed = ""
                                dismiss()
                            }
                        }
                    Button {
                        rawi = ""; dismiss()
                    } label: {
                        Text("أي حرف — يختاره الشاعر")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .foregroundStyle(rawi.isEmpty ? C.onAccent : C.ink)
                            .background(Capsule().fill(rawi.isEmpty ? accent : C.ink.opacity(0.08)))
                    }
                    .buttonStyle(.plain)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 48), spacing: 8)], spacing: 8) {
                        ForEach(MusajalaView.letters, id: \.self) { l in
                            Button {
                                rawi = l; dismiss()
                            } label: {
                                Text(l == "ا" ? "أ" : l)
                                    .font(Fonts.verse(24, bold: true))
                                    .frame(maxWidth: .infinity, minHeight: 48)
                                    .foregroundStyle(rawi == l ? C.onAccent : C.ink)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(rawi == l ? accent : C.ink.opacity(0.07)))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
            }
            .navigationTitle("حرف الروي")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() }.tint(accent) }
            }
            .keyboardDone()
        }
    }
}
