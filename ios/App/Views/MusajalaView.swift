// تبويب «المساجلة»: يبدأ بيتك بالحرف الذي ختم به صاحبك بيته (رويّه). استخراج الحرف، واختياره، والبحث بأول البيت،
// و«استعملته» لكل جولة، والبحث في كل أبيات الدواوين لا المطالع وحدها.
import SwiftUI

struct MusajalaView: View {
    @EnvironmentObject var app: AppState
    @State private var data: [SajItem] = []
    @State private var failed = false
    @State private var letter: String?
    @State private var prefix = ""
    @State private var friend = ""
    @State private var said: String?
    @State private var list: [SajItem] = []
    @State private var shown = 12
    @State private var used: Set<String> = []
    @State private var deepDone = false
    @State private var deepBusy = false
    @State private var deepNote = ""

    static let letters = "ابتثجحخدذرزسشصضطظعغفقكلمنهوي".map(String.init)
    static let names: [String: String] = ["ا": "الهمزة", "ب": "الباء", "ت": "التاء", "ث": "الثاء", "ج": "الجيم", "ح": "الحاء", "خ": "الخاء", "د": "الدال", "ذ": "الذال", "ر": "الراء", "ز": "الزاي", "س": "السين", "ش": "الشين", "ص": "الصاد", "ض": "الضاد", "ط": "الطاء", "ظ": "الظاء", "ع": "العين", "غ": "الغين", "ف": "الفاء", "ق": "القاف", "ك": "الكاف", "ل": "اللام", "م": "الميم", "ن": "النون", "ه": "الهاء", "و": "الواو", "ي": "الياء"]

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        PageTitle("المساجلة")
                        if data.isEmpty && !failed {
                            LoadingView(text: "يحمّل…")
                        } else if failed {
                            ErrorBox(text: "تعذّر التحميل.")
                        } else {
                            Lead("في المساجلة يبدأ بيتك بالحرف الذي ختم به صاحبك بيته، وهو رويّه. اكتب بيته لأستخرج الحرف، أو اختر الحرف بنفسك.")
                            HStack(spacing: 8) {
                                SearchField(placeholder: "بيت صاحبك (أو آخر كلمة منه)", text: $friend) { Task { await extract() } }
                                SmallButton(title: "استخرج الحرف") { Task { await extract() } }
                            }
                            if let s = said { Text(s).font(.subheadline.weight(.semibold)).foregroundStyle(C.accent) }
                            LazyVGrid(columns: [GridItem(.adaptive(minimum: 42), spacing: 6)], spacing: 6) {
                                ForEach(Self.letters, id: \.self) { l in
                                    Button {
                                        letter = letter == l ? nil : l
                                        said = nil
                                        pick()
                                    } label: {
                                        Text(l == "ا" ? "أ" : l)
                                            .font(Fonts.verse(22, bold: true))
                                            .frame(maxWidth: .infinity, minHeight: 42)
                                            .foregroundStyle(letter == l ? C.onAccent : C.ink)
                                            .background(letter == l ? C.accent : C.card)
                                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(letter == l ? C.accent : C.line, lineWidth: 1))
                                    }
                                    .buttonStyle(.plain)
                                }
                            }
                            SearchField(placeholder: "أو اكتب أول البيت إن كنت تذكره", text: $prefix)
                            Color.clear.frame(height: 0).id("head")
                            if letter != nil || !prefix.trimmingCharacters(in: .whitespaces).isEmpty {
                                headBar
                                if list.isEmpty { Lead("لا أبيات هنا. جرّب البحث في كل أبيات الدواوين أدناه.") }
                                ForEach(Array(list.prefix(shown).enumerated()), id: \.offset) { _, v in
                                    card(v)
                                }
                                if shown < list.count {
                                    SmallButton(title: "عرض المزيد", systemImage: "chevron.down") { shown += 12 }
                                        .frame(maxWidth: .infinity)
                                }
                                deepSection
                            }
                        }
                    }
                    .padding(16)
                    .readable()
                }
                .scrollDismissesKeyboard(.interactively)
                .background(Backdrop())
                .onChange(of: letter) { _ in withAnimation { proxy.scrollTo("head", anchor: .top) } }
            }
            .navigationBarTitleDisplayMode(.inline)
            .settingsButton()
        }
        .task {
            if data.isEmpty && !failed {
                do { data = try await Library.shared.loadSaj() } catch { failed = true }
            }
            applyShotLetter()
        }
        .onChange(of: app.shotLetter) { _ in applyShotLetter() }
        .task(id: prefix) {
            try? await Task.sleep(nanoseconds: 250_000_000)
            if Task.isCancelled { return }
            let p = prefix.trimmingCharacters(in: .whitespaces)
            if let f = Ar.firstLetter(p) { letter = f }
            if !data.isEmpty { pick() }
        }
    }

    private var headBar: some View {
        HStack {
            Text("\(letter.flatMap { Self.names[$0] }.map { "حرف " + $0 } ?? "ما يبدأ بما كتبت"): \(list.count.ar) بيت\(used.isEmpty ? "" : " · استعملتَ \(used.count.ar)")")
                .font(.subheadline).foregroundStyle(C.muted)
            Spacer()
            SmallButton(title: "غيرها", systemImage: "shuffle") { pick() }
            if !used.isEmpty { SmallButton(title: "جولة جديدة") { used.removeAll(); pick() } }
        }
    }

    @ViewBuilder private var deepSection: some View {
        if deepBusy {
            HStack(spacing: 8) { ProgressView(); Text(deepNote).font(.subheadline).foregroundStyle(C.muted) }
        } else if deepDone {
            Lead(deepNote)
        } else {
            SmallButton(title: "ابحث في كل أبيات الدواوين، لا المطالع وحدها", systemImage: "books.vertical") { Task { await deep() } }
        }
    }

    private func card(_ v: SajItem) -> some View {
        let isUsed = used.contains(v.key)
        let end = v.l ?? ""
        return VerseCard(sadr: v.s, ajz: v.a, dimmed: isUsed) {
            FlowLayout(spacing: 10) {
                if let p = v.p, !p.isEmpty { Text(p).fontWeight(.semibold).foregroundStyle(C.ink) }
                if let m = v.m, !m.isEmpty { Text(m) }
                if v.fromAnthology { Text("من المختارات") }
                if !end.isEmpty {
                    Button { letter = end; said = nil; pick() } label: {
                        Text("يختم ب\(Self.names[end] ?? end)")
                            .font(.footnote.weight(.semibold))
                            .padding(.horizontal, 8).padding(.vertical, 3)
                            .foregroundStyle(C.accent)
                            .background(C.accentSoft)
                            .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        } actions: {
            CopyButton(text: v.s + "    " + v.a + ((v.p ?? "").isEmpty ? "" : "\n— " + (v.p ?? ""))) { _ = used.insert(v.key) }
            SmallButton(title: "زِنه", systemImage: "scalemass") { app.weigh(v.s + " * " + v.a) }
            if let d = v.d, let i = v.i {
                SmallButton(title: "القصيدة", systemImage: "book") { app.openPoem(diwan: d, poem: i, verse: v.k ?? 0) }
            }
            SmallButton(title: isUsed ? "استُعمل ✓" : "استعملته", systemImage: isUsed ? nil : "checkmark") { _ = used.insert(v.key) }
        }
    }

    private func pick() {
        let p = Ar.norm(prefix)
        if letter == nil && p.isEmpty { list = []; return }
        let pool = data.filter { v in
            (letter == nil || v.f == letter) && (p.isEmpty || Ar.norm(v.s).hasPrefix(p)) && !used.contains(v.key)
        }
        list = pool.filter(\.fromAnthology).shuffled() + pool.filter { !$0.fromAnthology }.shuffled()
        shown = 12
        deepDone = false
        deepNote = ""
    }

    private func applyShotLetter() {
        guard let l = app.shotLetter, !data.isEmpty else { return }
        app.shotLetter = nil
        letter = l
        pick()
    }

    private func extract() async {
        let t = friend.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        let l = await WaznCore.shared.lastLetter(t)
        if l.isEmpty { said = "لم أتبيّن آخر حرف. اكتب البيت أو آخر كلمة منه."; return }
        said = "رويّ بيته \(l == "ا" ? "الهمزة أو الألف" : "«\(l)»")، فابدأ ب\(Self.names[l] ?? l)."
        letter = l
        pick()
    }

    private func deep() async {
        deepBusy = true
        deepNote = "يبحث في الدواوين…"
        let p = Ar.norm(prefix)
        let want = letter
        var found: [SajItem] = []
        guard let index = try? await Library.shared.loadIndex() else { deepBusy = false; return }
        for m in index {
            deepNote = "يبحث… \(m.name)"
            guard let d = try? await Library.shared.loadDiwan(m.id) else { continue }
            for (i, po) in d.poems.enumerated() {
                for (k, v) in po.v.enumerated() where !v.s.isEmpty && !v.a.isEmpty {
                    if let w = want, Ar.firstLetter(v.s) != w { continue }
                    if !p.isEmpty && !d.norms[i][k].hasPrefix(p) { continue }
                    found.append(SajItem(s: v.s, a: v.a, p: d.poetOf(po), m: po.m, f: want, l: nil, d: m.id, i: i, k: k, x: nil))
                }
            }
        }
        let seen = Set(list.map(\.key))
        let extra = found.filter { !seen.contains($0.key) && !used.contains($0.key) }.shuffled()
        list += extra
        deepBusy = false
        deepDone = true
        deepNote = "أُضيف \(extra.count.ar) بيت من حشو القصائد."
    }
}
