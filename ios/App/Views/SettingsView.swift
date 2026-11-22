// الإعدادات وعن «وزن»: مفتاح الذكاء الاصطناعي ونماذجه، وكيف يزن، والدقة، والمصادر، ورقم النسخة.
import SwiftUI

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var core = CoreStatus.shared
    @State private var key = ""
    @State private var show = false
    @State private var models: [AIModel] = []
    @State private var composeModel = "claude-opus-5-5"
    @State private var fixModel = "claude-sonnet-5-5"
    @State private var autoFix = true
    @State private var status = ""
    @State private var testing = false
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Group {
                        if show { TextField("sk-ant-…", text: $key) } else { SecureField("sk-ant-…", text: $key) }
                    }
                    .font(.body.monospaced())
                    .multilineTextAlignment(.leading)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                    Toggle("إظهار المفتاح", isOn: $show)
                    Picker("نموذج التأليف", selection: $composeModel) {
                        ForEach(models, id: \.id) { Text($0.label).tag($0.id) }
                    }
                    .pickerStyle(.menu)
                    Picker("نموذج التصحيح", selection: $fixModel) {
                        ForEach(models, id: \.id) { Text($0.label).tag($0.id) }
                    }
                    .pickerStyle(.menu)
                    Toggle("اقترح التعديل تلقائياً لأول ثلاثة أبيات مكسورة", isOn: $autoFix)
                    HStack(spacing: 12) {
                        Button("حفظ") { Task { await save(); status = "حُفظ ✓" } }.buttonStyle(.borderedProminent)
                        Button("جرّب المفتاح") { Task { await test() } }.buttonStyle(.bordered).disabled(testing)
                        Button("حذف المفتاح", role: .destructive) {
                            key = ""
                            Task { await save(); status = "حُذف المفتاح" }
                        }
                        .buttonStyle(.bordered)
                    }
                    if testing { ProgressView() }
                    if !status.isEmpty { Text(status).font(.footnote).foregroundStyle(C.muted) }
                } header: {
                    Text("الذكاء الاصطناعي")
                } footer: {
                    Text("للتأليف واقتراح التصحيح. ضع مفتاح الـ API من حسابك في console.anthropic.com. يُحفظ المفتاح على هذا الجهاز فقط، ويُرسل مباشرة إلى Anthropic.")
                }

                Section("كيف يزن؟") {
                    Text("يكتب «وزن» البيت كتابةً عروضية: ما يُنطق يُكتب وما لا يُنطق يُحذف؛ فالحرف المشدد حرفان، والتنوين نون ساكنة، وتسقط همزة الوصل في الدَّرج، وتُشبَع حركة آخر الشطر. ثم يحوّله إلى متحركات (/) وسواكن (ه)، ويطابقه على صور البحور الستة عشر بزحافاتها وعللها، فيعطيك البحر والتفعيلات، وإن كان في البيت كسر دلّك على موضعه وسببه.")
                }
                Section("والكلمات غير المشكولة؟") {
                    Text("معه قاموس فيه نطق \(core.dictSize > 0 ? core.dictSize.ar : "أكثر من مئة وسبعين ألف") كلمة، جُمع من نصوص تراثية مشكولة ومن دواوين الشعر. فإذا كتبت بلا تشكيل جرّب النطوق المحتملة لكل كلمة واختار ما يستقيم به الوزن. وإذا لم يجد الكلمة في القاموس قدّر تشكيلها، ووضع تحتها خطاً منقّطاً حتى تتأكد منها.")
                }
                Section("الدقة") {
                    Text("جُرّب على أبيات معروفة البحور لم يدخل شيء منها في القاموس، فأصاب البحر في ٩٣٪ منها (٨٣١٦ بيتاً). وأكثر ما يخطئ فيه البحور المتشابهة في أصلها، كالرجز والكامل المضمر، والسريع والرجز، والهزج ومجزوء الوافر؛ وهذه لا يحسم الأمرَ فيها إلا بقية أبيات القصيدة.")
                }
                Section("المختارات والدواوين") {
                    Text("أبيات «المختارات» نصها وحركاتها من كتب تراث والشاملة أولاً، وما نقص من ضبطها أُكمل من دواوين ويكي مصدر. و«عيون المتنبي» اختيار الصاحب بن عباد، وشرحها من شرح الواحدي. وديوان المتنبي من ويكي مصدر مع شرح الواحدي، و«ديوان الحماسة» بشرح التبريزي من تراث، وبقية الدواوين من مجموعة «أشعار» المأخوذة من موقع الديوان، وضبطها كما في مصدرها، وتحقيقها على الطبعات المحققة جارٍ.")
                }
                Section("بلا إنترنت والخصوصية") {
                    Text("الوزن والمختارات والدواوين والمساجلة كلها داخل التطبيق وتعمل بلا اتصال، ولا يُرسل شيء مما تكتب إلى أي مكان. أما «اكتب لي» و«اقترح تعديلاً» فيرسلان ما تكتبه فيهما إلى Anthropic عبر مفتاحك.")
                }
                Section {
                    HStack {
                        Text("الإصدار")
                        Spacer()
                        Text(AppInfo.version).foregroundStyle(C.muted)
                    }
                }
            }
            .navigationTitle("الإعدادات")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("تم") { Task { if loaded { await save() }; dismiss() } }
                }
            }
        }
        .task {
            models = await WaznCore.shared.models()
            if let s = try? await WaznCore.shared.settings() {
                key = s.key; composeModel = s.composeModel; fixModel = s.fixModel; autoFix = s.autoFix
            }
            loaded = true
        }
    }

    private func save() async {
        let s = AISettings(key: key.trimmingCharacters(in: .whitespacesAndNewlines), composeModel: composeModel, fixModel: fixModel, autoFix: autoFix)
        try? await WaznCore.shared.save(s)
    }

    private func test() async {
        await save()
        testing = true
        status = "يجرّب…"
        defer { testing = false }
        do {
            try await WaznCore.shared.testKey()
            status = "المفتاح يعمل ✓"
        } catch {
            status = error.localizedDescription
        }
    }
}
