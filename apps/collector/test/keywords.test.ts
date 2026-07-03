import { describe, expect, it, beforeAll } from "vitest";
import { countFocusKeywords, createTokenizer, extractTopKeywords, type Tokenizer } from "../src/keywords";

describe("countFocusKeywords", () => {
  it("부분일치로 포함 댓글 수를 센다(복합어·정규화 포함)", () => {
    const texts = [
      "水分ケアが最高です",
      "毛穴が気になる…水分ケアしたい",
      "ＫＯＲＥＡ 韓国コスメ大好き", // 전각/영문 섞임
      "普通のコメント",
    ];
    const res = countFocusKeywords(texts, ["水分ケア", "毛穴", "韓国コスメ", "化粧水"]);
    const map = Object.fromEntries(res.map((r) => [r.keyword, r.count]));
    expect(map["水分ケア"]).toBe(2);
    expect(map["毛穴"]).toBe(1);
    expect(map["韓国コスメ"]).toBe(1);
    expect(map["化粧水"]).toBeUndefined(); // 0 은 제외
  });
});

describe("extractTopKeywords", () => {
  let tokenizer: Tokenizer;
  beforeAll(async () => {
    tokenizer = await createTokenizer();
  }, 30_000);

  it("명사만 추출하고 조사·불용어·브랜드명을 제거해 빈도순 정렬한다", () => {
    const texts = [
      "毛穴が本当に気になるので化粧水を買いました",
      "毛穴に効く化粧水ですね",
      "アヌアの化粧水は毛穴によい", // 아래 exclude 로 アヌア 제거
    ];
    const res = extractTopKeywords(tokenizer, texts, { topN: 5, exclude: ["アヌア"] });
    const words = res.map((r) => r.keyword);
    expect(words).toContain("毛穴");
    expect(words).toContain("化粧水");
    expect(words).not.toContain("アヌア"); // exclude
    expect(words).not.toContain("が"); // 조사 제외
    // 毛穴(3) 가 化粧水(3) 와 함께 상위. count 검증
    const map = Object.fromEntries(res.map((r) => [r.keyword, r.count]));
    expect(map["毛穴"]).toBe(3);
    expect(map["化粧水"]).toBe(3);
  });
});
