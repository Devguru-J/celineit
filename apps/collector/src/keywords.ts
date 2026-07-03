import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import kuromoji from "kuromoji";

export type Tokenizer = kuromoji.Tokenizer<kuromoji.IpadicFeatures>;

const require = createRequire(import.meta.url);
// node_modules/kuromoji/build/kuromoji.js → ../dict
const DIC_PATH = join(dirname(require.resolve("kuromoji")), "..", "dict");

let tokenizerPromise: Promise<Tokenizer> | null = null;

export function createTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath: DIC_PATH }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

// 노이즈 명사(불용어). 의미 없는 일반 명사 + 자주 나오는 잡음.
const STOPWORDS = new Set([
  "こと", "もの", "ため", "これ", "それ", "あれ", "ここ", "そこ", "どこ",
  "さん", "ちゃん", "方", "人", "私", "僕", "今", "気", "的", "中", "感",
  "よう", "の", "笑", "件", "点", "所", "様", "君", "者",
]);

const KEEP = /[぀-ゟ゠-ヿ一-鿿A-Za-z]/; // 히라가나/가타카나/한자/영문 1자 이상 포함
const POS_NOUN = "名詞";
// 복합어 경계로 취급해 이어붙이지 않는 명사 세부품사(대명사·수·형식명사·부사가능).
// 接尾(접미: 化粧「水」·安心「感」)는 앞 명사에 붙여야 하므로 제외 → 이어붙임 허용.
const POS_DETAIL_SKIP = new Set(["非自立", "代名詞", "数", "副詞可能"]);

function normalize(s: string): string {
  return s.normalize("NFKC").toLowerCase();
}

export function extractTopKeywords(
  tokenizer: Tokenizer,
  texts: string[],
  opts?: { topN?: number; exclude?: string[] },
): { keyword: string; count: number }[] {
  const topN = opts?.topN ?? 10;
  const exclude = new Set((opts?.exclude ?? []).map(normalize));
  const counts = new Map<string, number>();

  // 연속한 내용 명사(content noun)를 하나의 복합어로 이어붙인다.
  // IPADIC 은 化粧水→化粧+水, 水分ケア→水分+ケア 처럼 복합어를 쪼개므로,
  // 조사·동사 등 비명사 토큰을 경계로 인접 명사를 합쳐 의미 단위를 복원한다.
  const flush = (buf: string[]) => {
    if (buf.length === 0) return;
    const phrase = buf.join("");
    if (phrase.length < 2) return;
    if (!KEEP.test(phrase)) return; // 이모지·기호·숫자만인 토큰 제외
    if (STOPWORDS.has(phrase)) return;
    if (exclude.has(normalize(phrase))) return;
    counts.set(phrase, (counts.get(phrase) ?? 0) + 1);
  };

  for (const text of texts) {
    if (!text) continue;
    let buf: string[] = [];
    for (const tok of tokenizer.tokenize(text)) {
      const isContentNoun = tok.pos === POS_NOUN && !POS_DETAIL_SKIP.has(tok.pos_detail_1);
      if (isContentNoun) {
        buf.push(tok.surface_form);
      } else {
        flush(buf);
        buf = [];
      }
    }
    flush(buf);
  }

  return [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword))
    .slice(0, topN);
}

export function countFocusKeywords(
  texts: string[],
  focus: string[],
): { keyword: string; count: number }[] {
  const normTexts = texts.map(normalize);
  const out: { keyword: string; count: number }[] = [];
  for (const kw of focus) {
    const needle = normalize(kw);
    let count = 0;
    for (const t of normTexts) if (t.includes(needle)) count++;
    if (count > 0) out.push({ keyword: kw, count });
  }
  return out.sort((a, b) => b.count - a.count);
}
