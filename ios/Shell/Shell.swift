// تطبيق الآيفون والآيباد: غلاف أصلي يعرض موقع التطبيق من ملفاته المضمّنة فيه، فيعمل بلا إنترنت.
// الملفات تُنسخ إلى مجلد Web عند البناء (انظر ios/build_web.sh) وتُقدَّم بعنوان app://localhost/
// حتى يعمل فيها كل ما يعمل في المتصفح: fetch وworker وlocalStorage.
import SwiftUI
import UIKit
import WebKit

@main
struct ShellApp: App {
    var body: some Scene {
        WindowGroup {
            WebScreen()
                .ignoresSafeArea()
                .background(Color("LaunchBackground").ignoresSafeArea())
                .preferredColorScheme(Shell.forceDark ? .dark : nil)
        }
    }
}

/// سجلّ تشخيص صغير في Documents/shell.log (يقرؤه بناء المحاكي للتأكد أن الصفحة فُتحت)
enum ShellLog {
    static let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("shell.log")
    static func write(_ line: String) {
        NSLog("[shell] %@", line)
        let data = Data((line + "\n").utf8)
        if let h = try? FileHandle(forWritingTo: url) { h.seekToEndOfFile(); h.write(data); try? h.close() }
        else { try? data.write(to: url) }
    }
}

enum Shell {
    static let scheme = "app"
    static let home = URL(string: "app://localhost/index.html")!
    static var forceDark: Bool { Bundle.main.object(forInfoDictionaryKey: "ShellForceDark") as? Bool ?? false }
    static var webRoot: URL { Bundle.main.resourceURL!.appendingPathComponent("Web", isDirectory: true) }
}

struct WebScreen: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> WebController { WebController() }
    func updateUIViewController(_ vc: WebController, context: Context) {}
}

final class WebController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var web: WKWebView!
    private let files = LocalFiles(root: Shell.webRoot)

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(files, forURLScheme: Shell.scheme)
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let content = config.userContentController
        content.add(self, name: "copy")
        content.add(self, name: "log")
        try? FileManager.default.removeItem(at: ShellLog.url)
        ShellLog.write("start root=\(Shell.webRoot.path) exists=\(FileManager.default.fileExists(atPath: Shell.webRoot.appendingPathComponent("index.html").path))")
        content.addUserScript(WKUserScript(source: """
        window.addEventListener('error', function (e) { try { window.webkit.messageHandlers.log.postMessage('js error: ' + e.message + ' @' + e.filename + ':' + e.lineno); } catch (x) {} });
        window.addEventListener('unhandledrejection', function (e) { try { window.webkit.messageHandlers.log.postMessage('js rejection: ' + (e.reason && (e.reason.message || e.reason))); } catch (x) {} });
        window.addEventListener('load', function () { try { window.webkit.messageHandlers.log.postMessage('loaded: ' + document.title + ' text=' + (document.body ? document.body.innerText.length : -1)); } catch (x) {} });
        """, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        // النسخ: يمرّ عبر التطبيق نفسه حتى يعمل زر «نسخ» دائماً
        content.addUserScript(WKUserScript(source: """
        (function () {
          var w = function (t) { window.webkit.messageHandlers.copy.postMessage(String(t)); return Promise.resolve(); };
          try {
            if (navigator.clipboard) Object.defineProperty(navigator.clipboard, 'writeText', { value: w, configurable: true });
            else Object.defineProperty(navigator, 'clipboard', { value: { writeText: w }, configurable: true });
          } catch (e) {}
        })();
        """, injectionTime: .atDocumentStart, forMainFrameOnly: false))

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsLinkPreview = false
        web.allowsBackForwardNavigationGestures = false
        let bg = UIColor(named: "LaunchBackground") ?? .systemBackground
        web.isOpaque = false
        web.backgroundColor = bg
        web.underPageBackgroundColor = bg
        web.scrollView.backgroundColor = bg
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: Shell.home))
    }

    // MARK: copy
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "copy", let text = message.body as? String { UIPasteboard.general.string = text }
        if message.name == "log" { ShellLog.write("\(message.body)") }
    }

    // MARK: links — روابط الإنترنت تُفتح في Safari
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if url.scheme == Shell.scheme || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" {
            return decisionHandler(.allow)
        }
        if action.targetFrame?.isMainFrame ?? true { UIApplication.shared.open(url) ; return decisionHandler(.cancel) }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { UIApplication.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        ShellLog.write("provisional fail: \(error)")
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        ShellLog.write("fail: \(error)")
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { ShellLog.write("finish \(webView.url?.absoluteString ?? "")") }

    // إذا أوقف النظام محتوى الصفحة في الخلفية: نعيد تحميلها بدل الشاشة البيضاء
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // MARK: alert / confirm / prompt
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "حسناً", style: .default) { _ in completionHandler() })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in completionHandler(false) })
        a.addAction(UIAlertAction(title: "نعم", style: .default) { _ in completionHandler(true) })
        present(a, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let a = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
        a.addTextField { $0.text = defaultText }
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in completionHandler(nil) })
        a.addAction(UIAlertAction(title: "تم", style: .default) { _ in completionHandler(a.textFields?.first?.text) })
        present(a, animated: true)
    }
}

/// يقدّم ملفات مجلد Web للصفحة بعنوان app://localhost/…
final class LocalFiles: NSObject, WKURLSchemeHandler {
    private let root: URL
    private var stopped = Set<ObjectIdentifier>()
    private let queue = DispatchQueue(label: "local-files", qos: .userInitiated)

    init(root: URL) { self.root = root.standardizedFileURL }

    private static let types: [String: String] = [
        "html": "text/html; charset=utf-8", "htm": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8", "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8", "json": "application/json; charset=utf-8",
        "webmanifest": "application/manifest+json; charset=utf-8",
        "txt": "text/plain; charset=utf-8", "tsv": "text/tab-separated-values; charset=utf-8",
        "svg": "image/svg+xml", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "gif": "image/gif", "webp": "image/webp", "ico": "image/x-icon",
        "woff2": "font/woff2", "woff": "font/woff", "ttf": "font/ttf", "otf": "font/otf",
        "mp3": "audio/mpeg", "m4a": "audio/mp4", "wav": "audio/wav", "mp4": "video/mp4",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path.hasSuffix("/") { path += "index.html" }
        let file = root.appendingPathComponent(String(path.drop(while: { $0 == "/" }))).standardizedFileURL
        let id = ObjectIdentifier(task)
        queue.async { [weak self] in
            guard let self else { return }
            let inside = file.path.hasPrefix(self.root.path + "/")
            let data = inside ? try? Data(contentsOf: file, options: .mappedIfSafe) : nil
            DispatchQueue.main.async {
                if self.stopped.remove(id) != nil { return }
                ShellLog.write("\(data == nil ? 404 : 200) \(url.path)")
                let type = Self.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
                let body = data ?? Data("not found".utf8)
                let response = HTTPURLResponse(url: url, statusCode: data == nil ? 404 : 200, httpVersion: "HTTP/1.1",
                    headerFields: ["Content-Type": data == nil ? "text/plain" : type,
                                   "Content-Length": String(body.count),
                                   "Cache-Control": "no-cache",
                                   "Access-Control-Allow-Origin": "*"])!
                task.didReceive(response)
                task.didReceive(body)
                task.didFinish()
            }
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        stopped.insert(ObjectIdentifier(task))
    }
}
