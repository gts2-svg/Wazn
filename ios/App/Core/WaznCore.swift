// الجسر بين الواجهة ومحرك «وزن»: يشغّل JS/wazn-core.js (المحرك والذكاء الاصطناعي من src/) داخل JavaScriptCore
// على طابور خلفي واحد، فلا تتجمد الواجهة أثناء الوزن. لا متصفح ولا صفحة ويب: JavaScriptCore محرك لغة فقط.
import Foundation
import JavaScriptCore

/// حالة تحميل المحرك والقاموس، للعرض في الواجهة
final class CoreStatus: ObservableObject {
    static let shared = CoreStatus()
    @Published var ready = false
    @Published var error: String?
    @Published var dictSize = 0
}

enum CoreError: LocalizedError {
    case notReady(String)
    case js(String)
    var errorDescription: String? {
        switch self {
        case .notReady(let s): return s
        case .js(let s): return "خطأ في المحرك: " + s
        }
    }
}

/// خطأ من الذكاء الاصطناعي بنصه العربي، مع تفاصيل للتصوير عند الحاجة
struct AIFailure: LocalizedError, Decodable {
    let message: String
    let diag: String
    let raw: String
    var errorDescription: String? { message }
    var details: String {
        var s = "النسخة: \(AppInfo.version)"
        if !diag.isEmpty { s += "\n" + diag }
        if !raw.isEmpty { s += "\nنص الرد:\n" + raw }
        return s
    }
    static func decode(_ json: String) -> AIFailure {
        (try? JSONDecoder().decode(AIFailure.self, from: Data(json.utf8))) ?? AIFailure(message: json, diag: "", raw: "")
    }
}

final class WaznCore: @unchecked Sendable {
    static let shared = WaznCore()

    private let queue = DispatchQueue(label: "wazn.core", qos: .userInitiated)
    private var ctx: JSContext?
    private var api: JSValue?
    private var bootError: String?
    private var lastException: String?
    private var started = false
    private lazy var session: URLSession = {
        let c = URLSessionConfiguration.default
        c.timeoutIntervalForRequest = 600
        c.timeoutIntervalForResource = 900
        c.waitsForConnectivity = true   // إن انقطع النت قبل الطلب ينتظر عودته بدل أن يفشل
        return URLSession(configuration: c)
    }()

    /// يبدأ تحميل المحرك والقاموس (مرة واحدة، في الخلفية)
    func start() {
        if started { return }
        started = true
        queue.async { self.boot() }
    }

    private func fail(_ msg: String) {
        bootError = msg
        DispatchQueue.main.async { CoreStatus.shared.error = msg }
    }

    private func boot() {
        guard let ctx = JSContext() else { fail("تعذّر تشغيل المحرك."); return }
        ctx.name = "wazn"
        ctx.exceptionHandler = { [weak self] _, e in
            let s = e?.toString() ?? "?"
            self?.lastException = s
            NSLog("[wazn-js] exception: %@", s)
        }
        let log: @convention(block) (String) -> Void = { NSLog("[wazn-js] %@", $0) }
        let console = JSValue(newObjectIn: ctx)!
        console.setObject(unsafeBitCast(log, to: AnyObject.self), forKeyedSubscript: "log" as NSString)
        console.setObject(unsafeBitCast(log, to: AnyObject.self), forKeyedSubscript: "warn" as NSString)
        console.setObject(unsafeBitCast(log, to: AnyObject.self), forKeyedSubscript: "error" as NSString)
        ctx.setObject(console, forKeyedSubscript: "console" as NSString)

        let native = JSValue(newObjectIn: ctx)!
        let storeGet: @convention(block) (String) -> String = { k in
            UserDefaults.standard.string(forKey: "wazn.js." + k) ?? ""
        }
        let storeSet: @convention(block) (String, String) -> Void = { k, v in
            UserDefaults.standard.set(v, forKey: "wazn.js." + k)
        }
        let fetch: @convention(block) (String, String, JSValue) -> Void = { [weak self] body, key, done in
            self?.post(body: body, key: key, done: done)
        }
        native.setObject(unsafeBitCast(storeGet, to: AnyObject.self), forKeyedSubscript: "storeGet" as NSString)
        native.setObject(unsafeBitCast(storeSet, to: AnyObject.self), forKeyedSubscript: "storeSet" as NSString)
        native.setObject(unsafeBitCast(fetch, to: AnyObject.self), forKeyedSubscript: "fetch" as NSString)
        ctx.setObject(native, forKeyedSubscript: "__native" as NSString)

        guard let coreURL = Bundle.main.url(forResource: "wazn-core", withExtension: "js", subdirectory: "JS"),
              let code = try? String(contentsOf: coreURL, encoding: .utf8) else { fail("ملف المحرك غير موجود في التطبيق."); return }
        ctx.evaluateScript(code, withSourceURL: coreURL)
        if let e = lastException { fail("تعذّر تشغيل المحرك: " + e); return }
        guard let api = ctx.objectForKeyedSubscript("Wazn"), api.isObject else { fail("تعذّر تشغيل المحرك."); return }

        guard let dictURL = Bundle.main.url(forResource: "dict", withExtension: "tsv", subdirectory: "Data"),
              let dict = try? String(contentsOf: dictURL, encoding: .utf8) else { fail("القاموس غير موجود في التطبيق."); return }
        let n = api.invokeMethod("init", withArguments: [dict])?.toInt32() ?? 0
        if let e = lastException { fail("تعذّر تحميل القاموس: " + e); return }

        self.ctx = ctx
        self.api = api
        DispatchQueue.main.async {
            CoreStatus.shared.dictSize = Int(n)
            CoreStatus.shared.ready = true
        }
    }

    /// يزيد عند كل إيقاف، فتُهمل الطلبات التي بدأت قبله
    private let genLock = NSLock()
    private var generation = 0
    private var currentGeneration: Int { genLock.lock(); defer { genLock.unlock() }; return generation }

    /// يوقف كل طلب جارٍ إلى Anthropic (زر «أوقف»)
    func cancelAll() {
        genLock.lock(); generation += 1; genLock.unlock()
        session.getAllTasks { $0.forEach { $0.cancel() } }
    }

    /// وصف مختصر للطلب في السجل: النموذج والجهد والأداة
    private static func describe(_ body: String) -> String {
        guard let d = body.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return "طلب" }
        let model = o["model"] as? String ?? "?"
        let effort = (o["output_config"] as? [String: Any])?["effort"] as? String ?? "بلا تفكير"
        let tool = ((o["tools"] as? [[String: Any]])?.first?["name"] as? String) ?? "-"
        let turns = (o["messages"] as? [Any])?.count ?? 0
        return "\(tool) · \(model) · جهد \(effort) · رسائل \(turns)"
    }

    /// ما يهم من الرد في السجل: السبب ورموز التفكير والخرج
    private static func summary(_ text: String) -> String {
        guard let d = text.data(using: .utf8),
              let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] else { return "" }
        if let e = o["error"] as? [String: Any] { return "خطأ: \(e["message"] as? String ?? "")" }
        let stop = o["stop_reason"] as? String ?? "?"
        let u = o["usage"] as? [String: Any] ?? [:]
        let inT = u["input_tokens"] as? Int ?? 0
        let outT = u["output_tokens"] as? Int ?? 0
        return "توقف: \(stop) · دخل \(inT) · خرج \(outT)"
    }

    /// طلب Anthropic من التطبيق نفسه؛ النتيجة تعود إلى JavaScript على طابور المحرك
    private func post(body: String, key: String, done: JSValue, attempt: Int = 0, gen: Int? = nil) {
        guard let url = URL(string: "https://api.anthropic.com/v1/messages") else { return }
        let myGen = gen ?? currentGeneration
        if myGen != currentGeneration {
            queue.async { done.call(withArguments: [0, "", true]) }
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 600
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.setValue(key, forHTTPHeaderField: "x-api-key")
        req.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        req.httpBody = body.data(using: .utf8)
        let what = Self.describe(body)
        let sent = Date()
        ComposeLog.shared.add("← أرسل \(what)\(attempt > 0 ? " (إعادة \(attempt))" : "")")
        session.dataTask(with: req) { [weak self] data, resp, err in
            guard let self else { return }
            let secs = Int(Date().timeIntervalSince(sent))
            let status = (resp as? HTTPURLResponse)?.statusCode ?? 0
            let text = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
            let netError = err != nil && resp == nil
            if myGen != self.currentGeneration {
                ComposeLog.shared.add("× أُلغي الطلب بعد \(secs)ث")
                self.queue.async { done.call(withArguments: [0, "", true]) }
                return
            }
            // انقطع الاتصال في أثناء الطلب: يعيده كل خمس ثوانٍ حتى يعود النت (إلى خمس دقائق)
            if netError, attempt < 60, let code = (err as? URLError)?.code,
               [.networkConnectionLost, .notConnectedToInternet, .timedOut, .cannotConnectToHost, .dnsLookupFailed, .cannotFindHost].contains(code) {
                ComposeLog.shared.add("! انقطع بعد \(secs)ث (URLError \(code.rawValue)) — يعيده بعد ٥ث")
                self.queue.asyncAfter(deadline: .now() + 5) {
                    self.post(body: body, key: key, done: done, attempt: attempt + 1, gen: myGen)
                }
                return
            }
            if let err { ComposeLog.shared.add("! فشل بعد \(secs)ث: \(err.localizedDescription)") }
            else { ComposeLog.shared.add("→ رد HTTP \(status) بعد \(secs)ث · \(Self.summary(text))") }
            self.queue.async {
                done.call(withArguments: [status, text, netError])
            }
        }.resume()
    }

    // MARK: - الاستدعاء

    /// استدعاء متزامن على طابور المحرك
    private func call<T>(_ body: @escaping (JSValue) -> T) async throws -> T {
        try await withCheckedThrowingContinuation { cont in
            queue.async {
                guard let api = self.api else {
                    cont.resume(throwing: CoreError.notReady(self.bootError ?? "المحرك لم يكتمل تحميله بعد."))
                    return
                }
                self.lastException = nil
                let v = body(api)
                if let e = self.lastException { cont.resume(throwing: CoreError.js(e)) } else { cont.resume(returning: v) }
            }
        }
    }

    /// استدعاء لعملية تنتهي لاحقاً (الذكاء الاصطناعي): آخر وسيطين onProgress وdone(نتيجة، خطأ)
    private func callAsync(_ method: String, _ args: [Any], progress: ((String) -> Void)?) async throws -> String {
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
            queue.async {
                guard let api = self.api, let ctx = self.ctx else {
                    cont.resume(throwing: CoreError.notReady(self.bootError ?? "المحرك لم يكتمل تحميله بعد."))
                    return
                }
                var finished = false
                let finish: (Result<String, Error>) -> Void = { r in
                    if finished { return }
                    finished = true
                    cont.resume(with: r)
                }
                let onProgress: @convention(block) (String) -> Void = { m in
                    if let p = progress { DispatchQueue.main.async { p(m) } }
                }
                let done: @convention(block) (JSValue?, JSValue?) -> Void = { r, e in
                    if let e = e, !e.isNull, !e.isUndefined {
                        finish(.failure(AIFailure.decode(e.toString() ?? "")))
                    } else {
                        finish(.success(r?.toString() ?? ""))
                    }
                }
                guard let jp = JSValue(object: unsafeBitCast(onProgress, to: AnyObject.self), in: ctx),
                      let jd = JSValue(object: unsafeBitCast(done, to: AnyObject.self), in: ctx) else {
                    finish(.failure(CoreError.js("callback")))
                    return
                }
                self.lastException = nil
                api.invokeMethod(method, withArguments: args + [jp, jd])
                if let e = self.lastException { finish(.failure(CoreError.js(e))) }
            }
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
        try JSONDecoder().decode(T.self, from: Data(json.utf8))
    }

    // MARK: - الواجهة

    func weigh(_ text: String) async throws -> WeighOutput {
        let json = try await call { $0.invokeMethod("weigh", withArguments: [text])?.toString() ?? "{}" }
        return try decode(WeighOutput.self, json)
    }

    func compose(_ p: ComposeParams, progress: @escaping (String) -> Void) async throws -> ComposeOutput {
        let pj = String(data: try JSONEncoder().encode(p), encoding: .utf8) ?? "{}"
        let json = try await callAsync("compose", [pj], progress: progress)
        return try decode(ComposeOutput.self, json)
    }

    func regenerateVerse(_ p: ComposeParams, poem: ComposeOutput, index: Int, progress: @escaping (String) -> Void) async throws -> ComposedVerse {
        let pj = String(data: try JSONEncoder().encode(p), encoding: .utf8) ?? "{}"
        let body = PoemForRegen(meter: poem.meter, rawi: poem.rawi, haraka: poem.haraka, verses: poem.verses.map { RegenVerse(sadr: $0.sadr, ajz: $0.ajz) })
        let poemJ = String(data: try JSONEncoder().encode(body), encoding: .utf8) ?? "{}"
        let json = try await callAsync("regenerateVerse", [pj, poemJ, index], progress: progress)
        return try decode(ComposedVerse.self, json)
    }

    func suggestFix(id: Int, rawi: String, haraka: String, progress: @escaping (String) -> Void) async throws -> [Suggestion] {
        let opts = String(data: try JSONEncoder().encode(["rawi": rawi, "haraka": haraka]), encoding: .utf8) ?? "{}"
        let json = try await callAsync("suggestFix", [id, opts], progress: progress)
        return try decode([Suggestion].self, json)
    }

    func testKey() async throws {
        _ = try await callAsync("testKey", [], progress: nil)
    }

    func settings() async throws -> AISettings {
        let json = try await call { $0.invokeMethod("settings", withArguments: [])?.toString() ?? "{}" }
        return try decode(AISettings.self, json)
    }

    func save(_ s: AISettings) async throws {
        let j = String(data: try JSONEncoder().encode(s), encoding: .utf8) ?? "{}"
        _ = try await call { $0.invokeMethod("saveSettings", withArguments: [j]) as Any }
    }

    func hasKey() async -> Bool {
        (try? await call { $0.invokeMethod("hasKey", withArguments: [])?.toBool() ?? false }) ?? false
    }

    func autoFixLimit() async -> Int {
        (try? await call { Int($0.invokeMethod("autoFixLimit", withArguments: [])?.toInt32() ?? 3) }) ?? 3
    }

    func meters() async -> [MeterInfo] {
        guard let json = try? await call({ $0.invokeMethod("meters", withArguments: [])?.toString() ?? "[]" }) else { return [] }
        return (try? decode([MeterInfo].self, json)) ?? []
    }

    func purposes() async -> [String] {
        guard let json = try? await call({ $0.invokeMethod("purposes", withArguments: [])?.toString() ?? "[]" }) else { return [] }
        return (try? decode([String].self, json)) ?? []
    }

    func models() async -> [AIModel] {
        guard let json = try? await call({ $0.invokeMethod("models", withArguments: [])?.toString() ?? "[]" }) else { return [] }
        return (try? decode([AIModel].self, json)) ?? []
    }

    func lastLetter(_ text: String) async -> String {
        (try? await call { $0.invokeMethod("lastLetter", withArguments: [text])?.toString() ?? "" }) ?? ""
    }
}
