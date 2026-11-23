// هوية «وزن»: أخضر ليلي وعناوين ذهبية بخط أميري في الوضع الداكن، وورقي وذهب عتيق في الفاتح؛ يتبع إعداد الجوال.
import SwiftUI
import UIKit
import CoreText

extension Color {
    init(hex: String) {
        var s = hex.trimmingCharacters(in: .whitespaces)
        if s.hasPrefix("#") { s.removeFirst() }
        let v = UInt64(s, radix: 16) ?? 0
        self.init(.sRGB, red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255, opacity: 1)
    }
    /// لون يتبدّل بين الفاتح والداكن
    init(light: String, dark: String) {
        self.init(UIColor { t in
            UIColor(Color(hex: t.userInterfaceStyle == .dark ? dark : light))
        })
    }
}

enum C {
    static let bg = Color(light: "#f6efe0", dark: "#0b1a17")
    static let card = Color(light: "#fffaf0", dark: "#142621")
    static let ink = Color(light: "#2a2418", dark: "#f3eee2")
    static let muted = Color(light: "#6e6656", dark: "#a9b7b1")
    static let line = Color(light: "#e6dac0", dark: "#24392f")
    static let accent = Color(light: "#8a5d10", dark: "#e8c36a")
    static let accentSoft = Color(light: "#f3e6c4", dark: "#2e3a2a")
    static let ok = Color(light: "#1d7a43", dark: "#7fe0b4")
    static let okSoft = Color(light: "#e4f3e8", dark: "#183027")
    static let bad = Color(light: "#b3261e", dark: "#ff9b8f")
    static let badSoft = Color(light: "#fbe9e7", dark: "#3a1f1c")
    static let warn = Color(light: "#9a6a00", dark: "#e2b44c")
    static let onAccent = Color(light: "#ffffff", dark: "#0f2622")
}

/// خلفية كل الشاشات: تدرّج ليلي في الداكن، وورقي في الفاتح
struct Backdrop: View {
    @Environment(\.colorScheme) private var scheme
    var glow: Color? = nil
    var body: some View {
        ZStack {
            if scheme == .dark {
                LinearGradient(colors: [Color(hex: "#0f2622"), Color(hex: "#0a1714"), Color(hex: "#081210")], startPoint: .top, endPoint: .bottom)
                RadialGradient(colors: [Color(hex: "#1d5a4f").opacity(0.40), .clear], center: UnitPoint(x: 0, y: 1.05), startRadius: 0, endRadius: 380)
            } else {
                LinearGradient(colors: [Color(hex: "#f8f2e4"), Color(hex: "#f3ead7"), Color(hex: "#efe4cc")], startPoint: .top, endPoint: .bottom)
            }
            if let g = glow {
                RadialGradient(colors: [g.opacity(scheme == .dark ? 0.30 : 0.18), .clear], center: UnitPoint(x: 0.9, y: -0.05), startRadius: 0, endRadius: 420)
            }
        }
        .ignoresSafeArea()
    }
}

/// عنوان الصفحة: كبير ذهبي بخط أميري، داخل المحتوى لا في الشريط حتى لا يُقص أعلى الحروف
struct PageTitle: View {
    let text: String
    var sub: String? = nil
    init(_ t: String, sub: String? = nil) { text = t; self.sub = sub }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(text)
                .font(Fonts.verse(44, bold: true))
                .foregroundStyle(C.accent)
                .lineLimit(1).minimumScaleFactor(0.6)
                .padding(.top, 8)
            if let s = sub { Text(s).font(.subheadline).foregroundStyle(C.muted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

enum Fonts {
    static func register() {
        guard let dir = Bundle.main.url(forResource: "Fonts", withExtension: nil),
              let files = try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil) else { return }
        for f in files where f.pathExtension.lowercased() == "ttf" {
            CTFontManagerRegisterFontsForURL(f as CFURL, .process, nil)
        }
    }
    /// خط الشعر: أميري (محفوظ داخل التطبيق)
    static func verse(_ size: CGFloat, bold: Bool = false) -> Font {
        let name = bold ? "Amiri-Bold" : "Amiri-Regular"
        if UIFont(name: name, size: size) != nil { return .custom(name, size: size, relativeTo: .body) }
        return .system(size: size, weight: bold ? .bold : .regular, design: .serif)
    }
    static func uiVerse(_ size: CGFloat) -> UIFont {
        UIFont(name: "Amiri-Regular", size: size) ?? .systemFont(ofSize: size)
    }
}

enum Appearance {
    static func apply() {
        let titleFont = UIFont(name: "Amiri-Bold", size: 21) ?? UIFont.boldSystemFont(ofSize: 18)
        // في أعلى الصفحة يكون الشريط شفافاً فتظهر الخلفية، وعند التمرير يصير ضبابياً
        let edge = UINavigationBarAppearance()
        edge.configureWithTransparentBackground()
        edge.titleTextAttributes = [.foregroundColor: UIColor(C.ink), .font: titleFont]
        let std = UINavigationBarAppearance()
        std.configureWithDefaultBackground()
        std.backgroundEffect = UIBlurEffect(style: .systemThinMaterial)
        std.backgroundColor = UIColor(C.bg).withAlphaComponent(0.55)
        std.shadowColor = UIColor(C.line)
        std.titleTextAttributes = [.foregroundColor: UIColor(C.ink), .font: titleFont]
        UINavigationBar.appearance().standardAppearance = std
        UINavigationBar.appearance().compactAppearance = std
        UINavigationBar.appearance().scrollEdgeAppearance = edge
        UINavigationBar.appearance().tintColor = UIColor(C.accent)

        let tab = UITabBarAppearance()
        tab.configureWithDefaultBackground()
        tab.backgroundColor = UIColor(C.card).withAlphaComponent(0.85)
        tab.shadowColor = UIColor(C.line)
        for item in [tab.stackedLayoutAppearance, tab.inlineLayoutAppearance, tab.compactInlineLayoutAppearance] {
            item.selected.iconColor = UIColor(C.accent)
            item.selected.titleTextAttributes = [.foregroundColor: UIColor(C.accent)]
            item.normal.iconColor = UIColor(C.muted)
            item.normal.titleTextAttributes = [.foregroundColor: UIColor(C.muted)]
        }
        UITabBar.appearance().standardAppearance = tab
        UITabBar.appearance().scrollEdgeAppearance = tab
    }
}

/// أرقام عربية: ١٢٣
extension Int {
    var ar: String {
        let f = NumberFormatter()
        f.locale = Locale(identifier: "ar-EG")
        f.numberStyle = .decimal
        return f.string(from: NSNumber(value: self)) ?? String(self)
    }
}

/// عرض محدود للمحتوى في الآيباد حتى لا تمتد الأسطر
struct Readable: ViewModifier {
    func body(content: Content) -> some View {
        content.frame(maxWidth: 760).frame(maxWidth: .infinity)
    }
}
extension View {
    func readable() -> some View { modifier(Readable()) }
}
