// قطع الواجهة المشتركة: البطاقة، والشارة، والبيت بشطريه، وبطاقة البيت بأزرارها، والرقائق، والتخطيط المتدفق.
import SwiftUI
import UIKit

extension View {
    func card(padding: CGFloat = 14) -> some View {
        self.padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(C.card)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(C.line, lineWidth: 1))
    }

    /// زر الإعدادات في شريط كل تبويب
    func settingsButton() -> some View { modifier(SettingsButton()) }
}

private struct SettingsButton: ViewModifier {
    @EnvironmentObject var app: AppState
    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                Button { app.showSettings = true } label: { Image(systemName: "gearshape") }
                    .accessibilityLabel("الإعدادات")
            }
        }
        .keyboardDone()
    }
}

struct Badge: View {
    let text: String
    let ok: Bool
    var body: some View {
        Text(text)
            .font(.footnote.weight(.semibold))
            .padding(.horizontal, 10).padding(.vertical, 4)
            .foregroundStyle(ok ? C.ok : C.bad)
            .background(ok ? C.okSoft : C.badSoft)
            .clipShape(Capsule())
    }
}

struct Lead: View {
    let text: String
    init(_ t: String) { text = t }
    var body: some View {
        Text(text).font(.subheadline).foregroundStyle(C.muted).frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// البيت بشطريه: الصدر ثم العجز، كلٌّ في سطر، بخط أميري
struct Bayt: View {
    let sadr: String
    let ajz: String
    var bad = false
    var size: CGFloat = 21
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(sadr).frame(maxWidth: .infinity, alignment: .leading)
            Text(ajz).frame(maxWidth: .infinity, alignment: .trailing)
        }
        .font(Fonts.verse(size))
        .foregroundStyle(bad ? C.bad : C.ink)
        .lineSpacing(4)
        .textSelection(.enabled)
    }
}

/// زر صغير بإطار
struct SmallButton: View {
    let title: String
    var systemImage: String? = nil
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                if let s = systemImage { Image(systemName: s).font(.footnote) }
                Text(title)
            }
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

/// زر رئيسي ممتلئ
struct PrimaryButton: View {
    let title: String
    var busy = false
    var disabled = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if busy { ProgressView().tint(C.onAccent) }
                Text(title).font(Fonts.verse(22, bold: true))
            }
            .frame(minWidth: 110, minHeight: 30)
            .padding(.horizontal, 24).padding(.vertical, 8)
            .foregroundStyle(C.onAccent)
            .background(C.accent.opacity(disabled ? 0.45 : 1))
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .disabled(disabled || busy)
    }
}

/// رقاقة اختيار (الأغراض، الحروف…)
struct Chip: View {
    let title: String
    var count: Int? = nil
    let on: Bool
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Text(title)
                if let n = count { Text(n.ar).font(.caption).opacity(0.75) }
            }
            .font(.subheadline.weight(on ? .semibold : .regular))
            .padding(.horizontal, 14).padding(.vertical, 7)
            .foregroundStyle(on ? C.onAccent : C.ink)
            .background(on ? C.accent : C.card)
            .clipShape(Capsule())
            .overlay(Capsule().stroke(on ? C.accent : C.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// حقل بحث بسيط
struct SearchField: View {
    let placeholder: String
    @Binding var text: String
    var onSubmit: () -> Void = {}
    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(C.muted)
            TextField(placeholder, text: $text)
                .submitLabel(.search)
                .onSubmit(onSubmit)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !text.isEmpty {
                Button { text = "" } label: { Image(systemName: "xmark.circle.fill").foregroundStyle(C.muted) }
                    .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .background(C.card)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(C.line, lineWidth: 1))
    }
}

/// بطاقة بيت: البيت، وسطر الشاعر والبحر والمصدر، والشرح عند الطلب، والأزرار
struct VerseCard<Meta: View, Actions: View>: View {
    let sadr: String
    let ajz: String
    var sharh: String? = nil
    var sharhFrom: String? = nil
    var sharhURL: URL? = nil
    var highlight = false
    var dimmed = false
    @ViewBuilder var meta: () -> Meta
    @ViewBuilder var actions: () -> Actions
    @State private var showSharh = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Bayt(sadr: sadr, ajz: ajz)
            meta()
                .font(.footnote)
                .foregroundStyle(C.muted)
            FlowLayout(spacing: 8) {
                if sharh != nil {
                    SmallButton(title: showSharh ? "إخفاء الشرح" : "الشرح", systemImage: "text.book.closed") {
                        withAnimation(.easeOut(duration: 0.2)) { showSharh.toggle() }
                    }
                }
                actions()
            }
            if showSharh, let s = sharh {
                VStack(alignment: .leading, spacing: 6) {
                    Text(s).font(.body).foregroundStyle(C.ink).lineSpacing(5).textSelection(.enabled)
                    if let from = sharhFrom, !from.isEmpty {
                        if let u = sharhURL {
                            Link(destination: u) { Text("من \(from)").font(.footnote) }
                        } else {
                            Text("من \(from)").font(.footnote).foregroundStyle(C.muted)
                        }
                    }
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(C.accentSoft.opacity(0.6))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
        }
        .card()
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(highlight ? C.accent : .clear, lineWidth: 2))
        .opacity(dimmed ? 0.55 : 1)
    }
}

/// زر نسخ يتبدّل نصه إلى «نُسخ ✓»
struct CopyButton: View {
    let text: String
    var title = "نسخ"
    var onCopy: () -> Void = {}
    @State private var done = false
    var body: some View {
        SmallButton(title: done ? "نُسخ ✓" : title, systemImage: done ? nil : "doc.on.doc") {
            UIPasteboard.general.string = text
            done = true
            onCopy()
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) { done = false }
        }
    }
}

/// تخطيط متدفق: يلف العناصر إلى السطر التالي إذا ضاق المكان (مع احترام اتجاه اليمين لليسار)
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    var lineSpacing: CGFloat? = nil

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, widest: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x > 0 && x + z.width > maxW { y += rowH + (lineSpacing ?? spacing); x = 0; rowH = 0 }
            x += z.width + spacing
            rowH = max(rowH, z.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + rowH)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for s in subviews {
            let z = s.sizeThatFits(.unspecified)
            if x > 0 && x + z.width > bounds.width { y += rowH + (lineSpacing ?? spacing); x = 0; rowH = 0 }
            // Layout يعكس المحور الأفقي تلقائياً في اتجاه اليمين لليسار
            s.place(at: CGPoint(x: bounds.minX + x, y: bounds.minY + y), proposal: ProposedViewSize(z))
            x += z.width + spacing
            rowH = max(rowH, z.height)
        }
    }
}

/// شاشة تحميل أو خطأ
struct LoadingView: View {
    let text: String
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
            Text(text).font(.subheadline).foregroundStyle(C.muted)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
    }
}

struct ErrorBox: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(C.bad)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(C.badSoft)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// زر «تم» فوق لوحة المفاتيح لإغلاقها
private struct KeyboardDone: ViewModifier {
    func body(content: Content) -> some View {
        content.toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("تم") {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
                .fontWeight(.semibold)
            }
        }
    }
}
extension View {
    func keyboardDone() -> some View { modifier(KeyboardDone()) }
}
