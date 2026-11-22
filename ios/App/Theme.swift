// هوية «وزن» كما في الموقع: ورقي فاتح وأخضر داكن، وخط أميري للشعر، ووضع داكن تلقائي.
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
    static let bg = Color(light: "#f6f2e9", dark: "#111513")
    static let card = Color(light: "#fffdf8", dark: "#1a201d")
    static let ink = Color(light: "#1d2523", dark: "#e9e5da")
    static let muted = Color(light: "#6b726d", dark: "#9aa39d")
    static let line = Color(light: "#e4ddcc", dark: "#2c3430")
    static let accent = Color(light: "#0f5c52", dark: "#5cc0ab")
    static let accentSoft = Color(light: "#e3efe9", dark: "#1d2e29")
    static let ok = Color(light: "#1d7a43", dark: "#6fd08f")
    static let okSoft = Color(light: "#e4f3e8", dark: "#1b2b21")
    static let bad = Color(light: "#b3261e", dark: "#ff8a80")
    static let badSoft = Color(light: "#fbe9e7", dark: "#321c1a")
    static let warn = Color(light: "#9a6a00", dark: "#e2b44c")
    static let onAccent = Color(light: "#ffffff", dark: "#0b1f1b")
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
        let nav = UINavigationBarAppearance()
        nav.configureWithOpaqueBackground()
        nav.backgroundColor = UIColor(C.bg)
        nav.shadowColor = UIColor(C.line)
        nav.titleTextAttributes = [.foregroundColor: UIColor(C.ink)]
        nav.largeTitleTextAttributes = [.foregroundColor: UIColor(C.ink), .font: UIFont(name: "Amiri-Bold", size: 34) ?? UIFont.boldSystemFont(ofSize: 34)]
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav

        let tab = UITabBarAppearance()
        tab.configureWithOpaqueBackground()
        tab.backgroundColor = UIColor(C.card)
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
