// نتائج المحرك كما تصل من Core/wazn-core.js (JSON جاهز للعرض)
import Foundation

struct WeighOutput: Decodable {
    let rhyme: RhymeUI?
    let items: [ResultUI]
}

struct RhymeUI: Decodable {
    let detail: String
    let badge: String
    let ok: Bool
    let rawi: String
    let haraka: String
}

struct ResultUI: Decodable, Identifiable {
    let id: Int
    let failed: Bool
    let label: String
    let title: String
    var message: String? = nil
    var meter: String? = nil
    var exact: Bool? = nil
    var badge: String? = nil
    var ok: Bool? = nil
    var notes: [String]? = nil
    var guesses: [String]? = nil
    var hemis: [HemiUI]? = nil
    var problems: [ProblemUI]? = nil
    var rhymeIssues: [RhymeIssueUI]? = nil
    var alts: [String]? = nil
    var needsFix: Bool? = nil

    /// مفتاح فريد للعرض (النتائج الفاشلة رقمها صفر)
    var key: String { "\(id)-\(label)-\(title)" }
}

struct HemiUI: Decodable {
    let label: String
    let half: Double
    let words: [WordUI]
    let feet: [FootUI]
}

struct WordUI: Decodable {
    let t: String
    let guess: Bool
    let broken: Bool
}

struct FootUI: Decodable {
    let text: String
    let sym: String
    let name: String
    let bad: Bool
    let exp: String
    let note: String
}

struct ProblemUI: Decodable {
    let head: String
    let what: String
    let can: String
}

struct RhymeIssueUI: Decodable {
    let kind: String
    let msg: String
}

struct ComposeParams: Encodable {
    var purpose: String
    var name: String
    var details: String
    var count: Int
    var meter: String?
    var rawi: String?
}

struct ComposeOutput: Decodable {
    let meter: String
    let rawi: String
    let haraka: String
    let rounds: Int
    let verses: [ComposedVerse]
}

struct ComposedVerse: Decodable {
    let sadr: String
    let ajz: String
    let ok: Bool
    let result: ResultUI?
}

struct Suggestion: Decodable {
    let sadr: String
    let ajz: String
    let note: String
    let title: String
}

struct AISettings: Codable {
    var key: String
    var composeModel: String
    var fixModel: String
    var autoFix: Bool

    init(key: String, composeModel: String, fixModel: String, autoFix: Bool) {
        self.key = key; self.composeModel = composeModel; self.fixModel = fixModel; self.autoFix = autoFix
    }

    init(from d: Decoder) throws {
        let c = try d.container(keyedBy: CodingKeys.self)
        key = (try? c.decode(String.self, forKey: .key)) ?? ""
        composeModel = (try? c.decode(String.self, forKey: .composeModel)) ?? "claude-opus-5-5"
        fixModel = (try? c.decode(String.self, forKey: .fixModel)) ?? "claude-sonnet-5-5"
        autoFix = (try? c.decode(Bool.self, forKey: .autoFix)) ?? true
    }
}

struct AIModel: Decodable, Hashable {
    let id: String
    let label: String
}

struct MeterInfo: Decodable, Hashable {
    let name: String
    let key: String
    let feet: String
}
