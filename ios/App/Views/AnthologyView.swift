// تبويب «المختارات»: عيون الشعر مرتبة على الأغراض، مع البحث والشرح والوزن والنسخ.
import SwiftUI

struct AnthologyView: View {
    @EnvironmentObject var app: AppState
    @State private var data: Anthology?
    @State private var searchIndex: [String] = []
    @State private var group = "الحكمة"
    @State private var query = ""
    @State private var failed = false

    static let intro: [String: String] = [
        "عيون المتنبي": "ما اختاره الصاحب بن عباد (ت ٣٨٥هـ) من أمثال المتنبي السائرة في كتابه «الأمثال السائرة من شعر المتنبي»، مرتبة من الأشهر في كتب التراث.",
        "الحكمة": "عيون الحكمة عند الفحول، ومعها أشهر أمثال المتنبي.",
        "المدح": "من أجود ما قيل في المدح.",
        "الرثاء": "من أجود ما قيل في الرثاء.",
        "الهجاء": "من عيون الهجاء عند الفحول: نقائض جرير والفرزدق والأخطل، والحطيئة وحسان وابن الرومي والمتنبي. تُرك منه ما فيه فحش، أو طعن في عِرض، أو عصبية لِلَّون.",
    ]

    private var list: [AnthItem] {
        guard let d = data else { return [] }
        let q = Ar.norm(query)
        return d.items.enumerated().filter { i, it in
            it.g.contains(group) && (q.isEmpty || searchIndex[i].contains(q))
        }.map(\.element)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    PageTitle("المختارات")
                    if let d = data {
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(d.meta.groups, id: \.self) { g in
                                    Chip(title: g, count: d.items.filter { $0.g.contains(g) }.count, on: g == group) { group = g }
                                }
                            }
                            .padding(.horizontal, 2).padding(.vertical, 2)
                        }
                        SearchField(placeholder: "ابحث في الأبيات أو باسم الشاعر", text: $query)
                        if let t = Self.intro[group] { Lead(t) }
                        let items = list
                        if items.isEmpty { Lead("لا نتائج.") }
                        ForEach(items) { v in
                            VerseCard(sadr: v.sadr, ajz: v.ajz, sharh: v.sharh?.text, sharhFrom: v.sharh?.book,
                                      sharhURL: v.sharh?.url.flatMap { URL(string: $0) }) {
                                HStack(spacing: 10) {
                                    Text(v.poet).fontWeight(.semibold).foregroundStyle(C.ink)
                                    if let m = v.meter, !m.isEmpty { Text(m) }
                                    if let u = v.src?.url, let url = URL(string: u) {
                                        Link("المصدر", destination: url)
                                    }
                                }
                            } actions: {
                                SmallButton(title: "زِنه", systemImage: "scalemass") { app.weigh(v.sadr + " * " + v.ajz) }
                                CopyButton(text: v.sadr + "    " + v.ajz + "\n— " + v.poet)
                            }
                        }
                    } else if failed {
                        ErrorBox(text: "تعذّر تحميل المختارات.")
                    } else {
                        LoadingView(text: "يحمّل المختارات…")
                    }
                }
                .padding(16)
                .readable()
            }
            .scrollDismissesKeyboard(.interactively)
            .background(Backdrop())
            .navigationBarTitleDisplayMode(.inline)
            .settingsButton()
        }
        .task {
            guard data == nil else { return }
            do {
                let d = try await Library.shared.loadAnthology()
                searchIndex = d.items.map(\.search)
                if !d.meta.groups.contains(group), let f = d.meta.groups.first { group = f }
                data = d
            } catch { failed = true }
        }
    }
}
