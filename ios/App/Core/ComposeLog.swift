// سجلّ النظم: لا يظهر للمستخدم، يُنسخ من الإعدادات عند الحاجة لمعرفة سبب التأخير
import Foundation
import UIKit

final class ComposeLog: @unchecked Sendable {
    static let shared = ComposeLog()
    private static let key = "wazn.lastComposeLog"

    private let lock = NSLock()
    private var lines: [String] = []
    private var start = Date()
    private var active = false

    private let clock: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "HH:mm:ss"
        return f
    }()

    /// يبدأ سجلاً جديداً لنظم جديد
    func begin(_ title: String) {
        lock.lock()
        start = Date()
        active = true
        lines = []
        lock.unlock()
        add(title)
        add("الجهاز: \(UIDevice.current.model)، iOS \(UIDevice.current.systemVersion)، الإصدار \(AppInfo.version)")
    }

    /// يضيف سطراً بوقته ومدته منذ البداية؛ لا يكتب شيئاً إن لم يكن نظم جارياً
    func add(_ s: String) {
        lock.lock()
        defer { lock.unlock() }
        guard active else { return }
        let t = Date().timeIntervalSince(start)
        lines.append("[\(clock.string(from: Date())) +\(Self.mmss(t))] \(s)")
    }

    /// ينهي السجل ويحفظه
    func end(_ s: String) {
        add(s)
        save()
        lock.lock(); active = false; lock.unlock()
    }

    func save() {
        lock.lock()
        let text = lines.joined(separator: "\n")
        lock.unlock()
        if !text.isEmpty { UserDefaults.standard.set(text, forKey: Self.key) }
    }

    var saved: String { UserDefaults.standard.string(forKey: Self.key) ?? "" }

    static func mmss(_ t: TimeInterval) -> String {
        let s = Int(t.rounded())
        return String(format: "%02d:%02d", s / 60, s % 60)
    }
}
