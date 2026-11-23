// تبويب «الدواوين»: قائمة الدواوين على العصور، وتصفح القصائد، والبحث في ديوان أو في الدواوين كلها، و«اقترح لي».
import SwiftUI

enum DiwanRoute: Hashable {
    case diwan(String, String)          // المعرّف، ونص بحث أولي
    case poem(String, Int, Int)         // المعرّف، رقم القصيدة، البيت المراد إبرازه (-1 لا شيء)
    case search(String)                 // البحث في كل الدواوين
}

struct DiwansView: View {
    @EnvironmentObject var app: AppState
    @State private var path: [DiwanRoute] = []
    @State private var index: [DiwanMeta] = []
    @State private var failed = false
    @State private var allQuery = ""

    static let eraOrder = ["العصر الجاهلي", "المخضرمون", "العصر الأموي", "العصر العباسي", "العصر الأندلسي", "العصر المملوكي"]

    var body: some View {
        NavigationStack(path: $path) {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 14) {
                    PageTitle("الدواوين")
                    if !index.isEmpty {
                        Lead("\(index.count.ar) ديواناً ومجموعة، فيها \(index.reduce(0) { $0 + $1.verses }.ar) بيت، محفوظة كلها في التطبيق وتعمل بلا إنترنت.")
                        SearchField(placeholder: "ابحث في كل الدواوين", text: $allQuery) {
                            let q = allQuery.trimmingCharacters(in: .whitespaces)
                            if Ar.norm(q).count >= 3 { path.append(.search(q)) }
                        }
                        ForEach(eras, id: \.self) { era in
                            Text(era).font(Fonts.verse(22, bold: true)).foregroundStyle(C.accent).padding(.top, 6)
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                                ForEach(index.filter { $0.era == era }) { d in
                                    NavigationLink(value: DiwanRoute.diwan(d.id, "")) { DiwanTile(d: d) }
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    } else if failed {
                        ErrorBox(text: "تعذّر تحميل قائمة الدواوين.")
                    } else {
                        LoadingView(text: "يحمّل…")
                    }
                }
                .padding(16)
                .readable()
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Backdrop())
            .navigationBarTitleDisplayMode(.inline)
            .settingsButton()
            .navigationDestination(for: DiwanRoute.self) { r in
                switch r {
                case .diwan(let id, let q): DiwanScreen(id: id, initialQuery: q)
                case .poem(let id, let i, let k): PoemScreen(id: id, poemIndex: i, focus: k)
                case .search(let q): AllSearchScreen(query: q)
                }
            }
        }
        .task {
            if index.isEmpty {
                do { index = try await Library.shared.loadIndex() } catch { failed = true }
            }
        }
        .onAppear { openRequested() }
        .onChange(of: app.poemRequest) { _ in openRequested() }
    }

    private var eras: [String] {
        let es = Set(index.map(\.era))
        return es.sorted { (Self.eraOrder.firstIndex(of: $0) ?? 99) < (Self.eraOrder.firstIndex(of: $1) ?? 99) }
    }

    private func openRequested() {
        guard let r = app.poemRequest else { return }
        app.poemRequest = nil
        path = [.diwan(r.diwan, ""), .poem(r.diwan, r.poem, r.verse)]
    }
}

struct DiwanTile: View {
    let d: DiwanMeta
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(d.name).font(.subheadline.weight(.bold)).foregroundStyle(C.ink).multilineTextAlignment(.leading)
            Text((d.isAnthology ? d.poet + " · " : "") + "\(d.poems.ar) قصيدة · \(d.verses.ar) بيت")
                .font(.caption).foregroundStyle(C.muted)
            if d.weak { Text("الضبط ناقص").font(.caption2).foregroundStyle(C.warn) }
        }
        .frame(maxWidth: .infinity, minHeight: 64, alignment: .topLeading)
        .card(padding: 12)
    }
}

/// بطاقة بيت من ديوان، بأزرارها
struct DiwanVerseCard: View {
    @EnvironmentObject var app: AppState
    let d: Diwan
    let poemIndex: Int
    let k: Int
    var withPoem = false
    var number: Int? = nil
    var highlight = false

    var body: some View {
        let p = d.poems[poemIndex], v = p.v[k]
        VerseCard(sadr: v.s, ajz: v.a, sharh: v.sharh, sharhFrom: d.sharhBook?.name, sharhURL: d.pageURL(p, v), highlight: highlight) {
            HStack(spacing: 10) {
                if let n = number { Text(n.ar).foregroundStyle(C.muted) }
                else { Text(String(d.poetOf(p).prefix(60))).fontWeight(.semibold).foregroundStyle(C.ink) }
                if withPoem { Text(String((d.isAnthology ? (p.sec ?? "") : p.t).prefix(50))).lineLimit(1) }
                if number == nil, let m = p.m, !m.isEmpty { Text(m) }
                if let u = d.pageURL(p, v) { Link("المصدر", destination: u) }
            }
        } actions: {
            SmallButton(title: "زِنه", systemImage: "scalemass") { app.weigh(v.s + " * " + v.a) }
            CopyButton(text: v.s + "    " + v.a + "\n— " + d.poetOf(p))
            if withPoem {
                NavigationLink(value: DiwanRoute.poem(d.id, poemIndex, k)) {
                    HStack(spacing: 4) { Image(systemName: "book").font(.footnote); Text("القصيدة") }
                        .font(.subheadline)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .foregroundStyle(C.accent)
                        .background(C.card)
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(C.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }
}

/// الديوان: البحث فيه، والتصفية بالبحر والباب، وقائمة قصائده، و«اقترح لي»
struct DiwanScreen: View {
    let id: String
    let initialQuery: String
    @State private var d: Diwan?
    @State private var meta: DiwanMeta?
    @State private var failed = false
    @State private var query = ""
    @State private var activeQuery = ""
    @State private var meter = ""
    @State private var sec = ""
    @State private var picks: [(Int, Int)]?

    private static let cap = 500

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                if let d {
                    header(d)
                    SearchField(placeholder: "ابحث في هذا الديوان", text: $query)
                    filters(d)
                    content(d)
                } else if failed {
                    ErrorBox(text: "تعذّر تحميل الديوان.")
                } else {
                    LoadingView(text: "يحمّل الديوان…")
                }
            }
            .padding(16)
            .readable()
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Backdrop())
        .navigationTitle(meta?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if d == nil {
                do {
                    let x = try await Library.shared.loadDiwan(id)
                    meta = try? await Library.shared.loadIndex().first { $0.id == id }
                    query = initialQuery
                    activeQuery = initialQuery
                    d = x
                } catch { failed = true }
            }
        }
        .task(id: query) {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if !Task.isCancelled { activeQuery = query; picks = nil }
        }
    }

    private func header(_ d: Diwan) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(d.name).font(Fonts.verse(28, bold: true)).foregroundStyle(C.ink)
            let n = meta.map { "\($0.poems.ar) قصيدة، \($0.verses.ar) بيت." } ?? ""
            Text((d.isAnthology ? d.poet + ". " : "") + n).font(.subheadline).foregroundStyle(C.muted)
            HStack(spacing: 6) {
                Text("المصدر:").font(.footnote).foregroundStyle(C.muted)
                if let u = d.sourceURL { Link(d.src?.name ?? "", destination: u).font(.footnote) }
                else { Text(d.src?.name ?? "").font(.footnote).foregroundStyle(C.muted) }
            }
            if let sb = d.sharhBook?.name, sb != d.src?.name {
                Text("والشرح من \(sb).").font(.footnote).foregroundStyle(C.muted)
            }
            if let note = d.note, !note.isEmpty { Text(note).font(.footnote).foregroundStyle(C.warn) }
        }
    }

    private func filters(_ d: Diwan) -> some View {
        let meters = Array(Set(d.poems.compactMap { $0.m }.filter { !$0.isEmpty })).sorted()
        let secs = d.sections ?? orderedUnique(d.poems.compactMap { $0.th }.filter { !$0.isEmpty })
        return FlowLayout(spacing: 8) {
            if meters.count > 1 {
                Picker("البحر", selection: $meter) {
                    Text("كل البحور").tag("")
                    ForEach(meters, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
                .onChange(of: meter) { _ in picks = nil }
            }
            if !secs.isEmpty {
                Picker("الباب", selection: $sec) {
                    Text(d.sections != nil ? "كل الأبواب" : "كل الأغراض").tag("")
                    ForEach(secs, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
                .onChange(of: sec) { _ in picks = nil }
            }
            SmallButton(title: "اقترح لي", systemImage: "dice") { suggest(d) }
        }
    }

    private func orderedUnique(_ a: [String]) -> [String] {
        var seen = Set<String>(); return a.filter { seen.insert($0).inserted }
    }

    private func poemsFiltered(_ d: Diwan) -> [Int] {
        d.poems.indices.filter { i in
            let p = d.poems[i]
            return (meter.isEmpty || p.m == meter) && (sec.isEmpty || p.sec == sec || p.th == sec)
        }
    }

    private func versesFound(_ d: Diwan, _ poems: [Int]) -> [(Int, Int)] {
        let q = Ar.norm(activeQuery)
        var out: [(Int, Int)] = []
        for i in poems {
            let ns = d.norms[i]
            for k in ns.indices where ns[k].contains(q) {
                out.append((i, k))
            }
        }
        return out
    }

    @ViewBuilder private func content(_ d: Diwan) -> some View {
        let poems = poemsFiltered(d)
        if let picks {
            Lead("خمسة أبيات اختيرت عشوائياً\(meter.isEmpty && sec.isEmpty ? "" : " مما اخترت"). اضغط «اقترح لي» لغيرها.")
            ForEach(Array(picks.enumerated()), id: \.offset) { _, x in
                DiwanVerseCard(d: d, poemIndex: x.0, k: x.1, withPoem: true)
            }
        } else if !Ar.norm(activeQuery).isEmpty {
            let vs = versesFound(d, poems)
            Lead(vs.count > Self.cap ? "\(vs.count.ar) بيت (تظهر أول \(Self.cap.ar)؛ ضيّق البحث)" : "\(vs.count.ar) بيت")
            if vs.isEmpty { Lead("لا نتائج.") }
            ForEach(Array(vs.prefix(Self.cap).enumerated()), id: \.offset) { _, x in
                DiwanVerseCard(d: d, poemIndex: x.0, k: x.1, withPoem: true)
            }
        } else {
            Lead("\(poems.count.ar) قصيدة")
            ForEach(poems, id: \.self) { i in
                let p = d.poems[i]
                NavigationLink(value: DiwanRoute.poem(d.id, i, -1)) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(d.titleOf(p)).font(.subheadline.weight(.semibold)).foregroundStyle(C.accent).lineLimit(1)
                        Text(p.v.first?.s ?? "").font(Fonts.verse(19)).foregroundStyle(C.ink).lineLimit(1)
                        Text([d.sections != nil ? (p.sec ?? "") : "", p.m ?? "", "\(p.v.count.ar) بيت"].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.caption).foregroundStyle(C.muted)
                    }
                    .card(padding: 12)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func suggest(_ d: Diwan) {
        let poems = poemsFiltered(d)
        var pool: [(Int, Int)] = Ar.norm(activeQuery).isEmpty ? poems.flatMap { i in d.poems[i].v.indices.map { (i, $0) } } : versesFound(d, poems)
        pool.shuffle()
        picks = Array(pool.prefix(5))
    }
}

/// القصيدة كاملة، مع إبراز البيت المطلوب
struct PoemScreen: View {
    let id: String
    let poemIndex: Int
    let focus: Int
    @State private var d: Diwan?

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if let d, d.poems.indices.contains(poemIndex) {
                        let p = d.poems[poemIndex]
                        Text(d.titleOf(p)).font(Fonts.verse(26, bold: true)).foregroundStyle(C.ink)
                        Lead([d.isAnthology ? (p.sec ?? "") : d.poet, p.m ?? "", "\(p.v.count.ar) بيت"].filter { !$0.isEmpty }.joined(separator: " · "))
                        ForEach(p.v.indices, id: \.self) { k in
                            DiwanVerseCard(d: d, poemIndex: poemIndex, k: k, number: k + 1, highlight: k == focus)
                                .id(k)
                        }
                    } else {
                        LoadingView(text: "يحمّل…")
                    }
                }
                .padding(16)
                .readable()
            }
            .background(Backdrop())
            .task {
                if d == nil {
                    d = try? await Library.shared.loadDiwan(id)
                    if focus >= 0 {
                        try? await Task.sleep(nanoseconds: 300_000_000)
                        withAnimation { proxy.scrollTo(focus, anchor: .center) }
                    }
                }
            }
        }
        .navigationTitle(d?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let d, d.poems.indices.contains(poemIndex) {
                ToolbarItem(placement: .navigationBarTrailing) {
                    let p = d.poems[poemIndex]
                    CopyButton(text: p.t + "\n\n" + p.v.map { $0.s + "    " + $0.a }.joined(separator: "\n") + "\n— " + d.poetOf(p), title: "نسخ القصيدة")
                }
            }
        }
    }
}

/// البحث في كل الدواوين (أول ٣٠٠ نتيجة)
struct AllSearchScreen: View {
    let query: String
    @State private var groups: [(Diwan, [(Int, Int)])] = []
    @State private var progress = ""
    @State private var total = 0
    @State private var done = false
    private static let cap = 300

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
                Text("«\(query)»").font(Fonts.verse(24, bold: true))
                if !done {
                    HStack(spacing: 8) { ProgressView(); Text(progress).font(.subheadline).foregroundStyle(C.muted) }
                } else {
                    Lead(total == 0 ? "لا نتائج." : "\(total.ar) بيت\(total >= Self.cap ? " (أول ٣٠٠ نتيجة؛ ضيّق البحث)" : "")")
                }
                ForEach(Array(groups.enumerated()), id: \.offset) { _, g in
                    let d = g.0
                    let hits = g.1
                    HStack {
                        Text(d.name).font(Fonts.verse(21, bold: true)).foregroundStyle(C.accent)
                        Text(hits.count.ar).font(.caption).foregroundStyle(C.muted)
                    }
                    .padding(.top, 6)
                    ForEach(Array(hits.prefix(30).enumerated()), id: \.offset) { _, h in
                        DiwanVerseCard(d: d, poemIndex: h.0, k: h.1, withPoem: true)
                    }
                    if hits.count > 30 {
                        NavigationLink(value: DiwanRoute.diwan(d.id, query)) {
                            Text("كل نتائج \(d.name)").font(.subheadline.weight(.semibold))
                        }
                    }
                }
            }
            .padding(16)
            .readable()
        }
        .background(Backdrop())
        .navigationTitle("البحث في الدواوين")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if done || !groups.isEmpty { return }
            let q = Ar.norm(query)
            guard let index = try? await Library.shared.loadIndex() else { done = true; return }
            var n = 0
            for m in index {
                if Task.isCancelled { return }
                progress = "يبحث… \(m.name)"
                guard let d = try? await Library.shared.loadDiwan(m.id) else { continue }
                var hits: [(Int, Int)] = []
                for (i, ns) in d.norms.enumerated() {
                    for (k, x) in ns.enumerated() where x.contains(q) && n + hits.count < Self.cap {
                        hits.append((i, k))
                    }
                }
                if !hits.isEmpty { groups.append((d, hits)); n += hits.count }
                total = n
                if n >= Self.cap { break }
            }
            done = true
        }
    }
}
