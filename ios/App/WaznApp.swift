// وزن — ميزان الشعر العربي الفصيح. تطبيق SwiftUI أصلي للآيفون والآيباد، بلا صفحة ويب.
// الواجهة كلها هنا في Swift، ومحرك الوزن والذكاء الاصطناعي من src/ يعملان داخل JavaScriptCore (Core/WaznCore.swift).
import SwiftUI
import UIKit

@main
struct WaznApp: App {
    @StateObject private var app = AppState()

    init() {
        Fonts.register()
        Appearance.apply()
        WaznCore.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(app)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar"))
                .tint(C.accent)
                .onAppear {
                    KeyboardDismisser.install()
                    #if DEBUG
                    Shot.afterLaunch(app)
                    #endif
                }
        }
    }
}

enum AppTab: Hashable { case weigh, write, anthology, diwans, musajala }

/// حالة التطبيق المشتركة: التبويب الحالي، والتنقل بين التبويبات («زِنه»، «القصيدة»)
@MainActor
final class AppState: ObservableObject {
    @Published var tab: AppTab = .weigh
    /// نص يُرسل إلى «زِن» ويُوزن فوراً
    @Published var weighRequest: WeighRequest?
    /// قصيدة تُفتح في «الدواوين» (من المساجلة مثلاً)
    @Published var poemRequest: PoemRequest?
    @Published var showSettings = false
    /// حرف يُختار في المساجلة (لوضع التصوير)
    @Published var shotLetter: String?

    func weigh(_ text: String) {
        weighRequest = WeighRequest(text: text)
        tab = .weigh
    }
    func openPoem(diwan: String, poem: Int, verse: Int) {
        poemRequest = PoemRequest(diwan: diwan, poem: poem, verse: verse)
        tab = .diwans
    }
}

struct WeighRequest: Equatable { let id = UUID(); let text: String }
struct PoemRequest: Equatable { let id = UUID(); let diwan: String; let poem: Int; let verse: Int }

struct RootView: View {
    @EnvironmentObject var app: AppState

    var body: some View {
        TabView(selection: $app.tab) {
            WeighView()
                .tabItem { Label("زِن", systemImage: "scalemass") }
                .tag(AppTab.weigh)
            WriteView()
                .tabItem { Label("اكتب لي", systemImage: "pencil.and.outline") }
                .tag(AppTab.write)
            AnthologyView()
                .tabItem { Label("المختارات", systemImage: "star") }
                .tag(AppTab.anthology)
            DiwansView()
                .tabItem { Label("الدواوين", systemImage: "books.vertical") }
                .tag(AppTab.diwans)
            MusajalaView()
                .tabItem { Label("المساجلة", systemImage: "arrow.left.arrow.right") }
                .tag(AppTab.musajala)
        }
        .sheet(isPresented: $app.showSettings) {
            SettingsView()
                .environment(\.layoutDirection, .rightToLeft)
        }
    }
}

/// رقم النسخة كما يظهر للمستخدم: «2.0.0 (12)»
enum AppInfo {
    static var version: String {
        let v = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
        let b = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? ""
        return b.isEmpty || b == "1" ? v : "\(v) (\(b))"
    }
}

/// يغلق لوحة المفاتيح عند لمس أي مكان خارج حقل الكتابة
@MainActor
enum KeyboardDismisser {
    final class Delegate: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
            var v: UIView? = touch.view
            while let x = v { if x is UITextField || x is UITextView { return false }; v = x.superview }
            return true
        }
        func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
        @objc func tapped(_ g: UITapGestureRecognizer) { g.view?.window?.endEditing(true) }
    }
    static let delegate = Delegate()
    static var installed = false
    static func install() {
        if installed { return }
        Task { @MainActor in
            let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap { $0.windows }
            guard let w = windows.first(where: { $0.isKeyWindow }) ?? windows.first else { return }
            let t = UITapGestureRecognizer(target: delegate, action: #selector(Delegate.tapped(_:)))
            t.cancelsTouchesInView = false
            t.delegate = delegate
            w.addGestureRecognizer(t)
            installed = true
        }
    }
}
