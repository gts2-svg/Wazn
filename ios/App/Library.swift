// بيانات الشعر المحفوظة داخل التطبيق: المختارات والدواوين والمساجلة، تُقرأ من مجلد Data وتعمل بلا إنترنت.
import Foundation

/// تطبيع للبحث: بلا حركات ولا تطويل، وتوحيد الهمزات والياء والتاء المربوطة (مثل normAr في src/diwans.js)
enum Ar {
    private static let marks: Set<Unicode.Scalar> = {
        var s = Set<Unicode.Scalar>()
        for v in UInt32(0x064B)...UInt32(0x0652) { s.insert(Unicode.Scalar(v)!) }
        s.insert(Unicode.Scalar(UInt32(0x0670))!)
        s.insert(Unicode.Scalar(UInt32(0x0640))!)
        return s
    }()
    static func norm(_ s: String) -> String {
        var out = String.UnicodeScalarView()
        var lastSpace = true
        for u in s.unicodeScalars {
            if marks.contains(u) { continue }
            var c = u
            switch u.value {
            case 0x0623, 0x0625, 0x0622, 0x0671: c = "ا"
            case 0x0649: c = "ي"
            case 0x0629: c = "ه"
            case 0x0624: c = "و"
            case 0x0626: c = "ي"
            default: break
            }
            let isArabic = (0x0621...0x064A).contains(c.value)
            if isArabic {
                out.append(c)
                lastSpace = false
            } else if !lastSpace {
                out.append(" ")
                lastSpace = true
            }
        }
        var r = String(out)
        if r.hasSuffix(" ") { r.removeLast() }
        return r
    }
    /// أول حرف في النص، بتوحيد الهمزة والألف والتاء المربوطة (مثل firstLetter في src/musajala.js)
    static func firstLetter(_ s: String) -> String? {
        for u in s.unicodeScalars {
            if marks.contains(u) { continue }
            if (0x0621...0x064A).contains(u.value) || u.value == 0x0671 { return letterOf(Character(u)) }
        }
        return nil
    }
    static func letterOf(_ c: Character) -> String {
        if "أإآاٱءىؤئ".contains(c) { return "ا" }
        if c == "ة" { return "ت" }
        return String(c)
    }
}

enum DataFile {
    static func url(_ name: String) -> URL? {
        Bundle.main.url(forResource: name, withExtension: nil, subdirectory: "Data")
    }
    static func load<T: Decodable>(_ type: T.Type, _ name: String) throws -> T {
        guard let u = url(name) else { throw CocoaError(.fileNoSuchFile) }
        return try JSONDecoder().decode(T.self, from: Data(contentsOf: u))
    }
}

// MARK: - المختارات

struct Anthology: Decodable {
    struct Meta: Decodable { let groups: [String] }
    let meta: Meta
    let items: [AnthItem]
}

struct SrcRef: Decodable, Hashable {
    let book: String?
    let url: String?
    let name: String?
    let text: String?
}

struct AnthItem: Decodable, Identifiable, Hashable {
    var id: String { sadr + "|" + ajz }
    let g: [String]
    let poet: String
    let sadr: String
    let ajz: String
    let meter: String?
    let poem: String?
    let src: SrcRef?
    let sharh: SrcRef?
    var search: String { Ar.norm(sadr + " " + ajz + " " + poet) }
}

// MARK: - الدواوين

struct DiwanMeta: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let poet: String
    let era: String
    let kind: String
    let note: String?
    let poems: Int
    let verses: Int
    var isAnthology: Bool { kind == "anthology" }
    var weak: Bool { !(note ?? "").isEmpty }
}

/// بيت في ديوان: [صدر، عجز، شرح، صفحة]
struct DVerse: Decodable, Hashable {
    let s: String
    let a: String
    let sharh: String?
    let page: Int?
    init(from d: Decoder) throws {
        var c = try d.unkeyedContainer()
        s = (try? c.decode(String.self)) ?? ""
        a = c.isAtEnd ? "" : ((try? c.decode(String.self)) ?? "")
        let sh = c.isAtEnd ? nil : (try? c.decode(String.self))
        sharh = (sh ?? "").isEmpty ? nil : sh
        page = c.isAtEnd ? nil : (try? c.decode(Int.self))
    }
}

struct Poem: Decodable, Hashable {
    let t: String
    let m: String?
    let th: String?
    let sec: String?
    let poet: String?
    let pg: Int?
    let v: [DVerse]
}

final class Diwan: Decodable, @unchecked Sendable {
    let id: String
    let name: String
    let poet: String
    let era: String
    let kind: String
    let note: String?
    let src: SrcRef?
    let sharhBook: SrcRef?
    let sections: [String]?
    let poems: [Poem]
    /// نص كل بيت مطبّعاً للبحث: norms[قصيدة][بيت]
    private(set) var norms: [[String]] = []

    enum CodingKeys: String, CodingKey { case id, name, poet, era, kind, note, src, sharhBook, sections, poems }

    var isAnthology: Bool { kind == "anthology" }
    func prepare() { norms = poems.map { $0.v.map { Ar.norm($0.s + " " + $0.a) } } }
    func poetOf(_ p: Poem) -> String { isAnthology ? (p.poet ?? "") : poet }
    func titleOf(_ p: Poem) -> String { isAnthology ? (p.poet ?? p.t) : p.t }
    func pageURL(_ p: Poem, _ v: DVerse) -> URL? {
        guard let base = sharhBook?.url, let pg = v.page ?? p.pg else { return nil }
        return URL(string: base + String(pg))
    }
    var sourceURL: URL? {
        guard let u = src?.url else { return nil }
        return URL(string: u.hasSuffix("?page=") ? String(u.dropLast(6)) : u)
    }
}

// MARK: - المساجلة

struct SajItem: Decodable, Hashable {
    let s: String
    let a: String
    let p: String?
    let m: String?
    let f: String?
    let l: String?
    let d: String?
    let i: Int?
    let k: Int?
    let x: Int?
    var key: String { Ar.norm(s + a) }
    var fromAnthology: Bool { (x ?? 0) != 0 }
}

struct SajFile: Decodable { let items: [SajItem] }

// MARK: - المكتبة

/// تحميل كسول مع ذاكرة: الملفات تُقرأ أول مرة تُطلب
actor Library {
    static let shared = Library()
    private var anthology: Anthology?
    private var index: [DiwanMeta]?
    private var diwans: [String: Diwan] = [:]
    private var saj: [SajItem]?

    func loadAnthology() throws -> Anthology {
        if let a = anthology { return a }
        let a = try DataFile.load(Anthology.self, "mukhtarat.json")
        anthology = a
        return a
    }

    func loadIndex() throws -> [DiwanMeta] {
        if let i = index { return i }
        let i = try DataFile.load([DiwanMeta].self, "diwans/index.json")
        index = i
        return i
    }

    func loadDiwan(_ id: String) throws -> Diwan {
        if let d = diwans[id] { return d }
        let d = try DataFile.load(Diwan.self, "diwans/\(id).json")
        d.prepare()
        diwans[id] = d
        return d
    }

    func loadSaj() throws -> [SajItem] {
        if let s = saj { return s }
        let s = try DataFile.load(SajFile.self, "musajala.json").items
        saj = s
        return s
    }
}
