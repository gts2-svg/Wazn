// البحور الستة عشر بمفاتيحها (لصفي الدين الحلي) وتفعيلاتها؛ الضغط على بحر يزن مفتاحه.
import SwiftUI

struct MetersView: View {
    var onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var meters: [MeterInfo] = []

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Lead("البحور الستة عشر بمفاتيحها (لصفي الدين الحلي) وتفعيلاتها. اضغط على أي بحر لتجرّب مفتاحه.")
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 300), spacing: 10)], spacing: 10) {
                        ForEach(meters, id: \.name) { m in
                            Button { onPick(m.key) } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    Text(m.name).font(Fonts.verse(24, bold: true)).foregroundStyle(C.accent)
                                    Text(m.key).font(Fonts.verse(20)).foregroundStyle(C.ink)
                                    Text(m.feet).font(.subheadline).foregroundStyle(C.muted)
                                }
                                .card()
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding(16)
                .readable()
            }
            .background(Backdrop())
            .navigationTitle("البحور")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("تم") { dismiss() } }
            }
        }
        .task { if meters.isEmpty { meters = await WaznCore.shared.meters() } }
    }
}
