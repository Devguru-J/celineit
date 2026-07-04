import { describe, expect, it } from "vitest";
import { getAdapter } from "../src/adapters";
import metaFixture from "./fixtures/meta-ads.json";
import igFixture from "./fixtures/instagram.json";
import twFixture from "./fixtures/twitter.json";
import ttFixture from "./fixtures/tiktok.json";
import ttAdsFixture from "./fixtures/tiktok-ads.json";

describe("meta-ads 어댑터", () => {
  const r = getAdapter("meta_ads").normalize(metaFixture);

  it("광고 3건을 정규화한다", () => {
    expect(r.ads).toHaveLength(3);
    expect(r.posts).toHaveLength(0);
  });

  it("포맷을 추론한다 (image/video/carousel)", () => {
    const byId = Object.fromEntries(r.ads.map((a) => [a.platformAdId, a]));
    expect(byId["120210000001"].format).toBe("image");
    expect(byId["120210000002"].format).toBe("video");
    expect(byId["120210000003"].format).toBe("carousel");
  });

  it("landing domain 을 추출한다", () => {
    const ad = r.ads.find((a) => a.platformAdId === "120210000001")!;
    expect(ad.landingDomain).toBe("celine.com");
    expect(ad.seenActive).toBe(true);
    expect(ad.mediaUrls.length).toBeGreaterThan(0);
  });
});

describe("instagram 어댑터", () => {
  const r = getAdapter("instagram").normalize(igFixture);

  it("포스트 2건 + 계정 팔로워를 정규화한다", () => {
    expect(r.posts).toHaveLength(2);
    expect(r.accountMetric?.followers).toBe(1840000);
  });

  it("Sidecar=carousel, Video=video 로 매핑한다", () => {
    const byId = Object.fromEntries(r.posts.map((p) => [p.platformPostId, p]));
    expect(byId["3001"].format).toBe("carousel");
    expect(byId["3002"].format).toBe("video");
    expect(byId["3001"].metrics.likes).toBe(84200);
  });
});

describe("twitter 어댑터", () => {
  const r = getAdapter("twitter").normalize(twFixture);

  it("트윗 2건 + 팔로워를 정규화한다", () => {
    expect(r.posts).toHaveLength(2);
    expect(r.accountMetric?.followers).toBe(5200000);
  });

  it("video 미디어가 있으면 video 포맷", () => {
    const byId = Object.fromEntries(r.posts.map((p) => [p.platformPostId, p]));
    expect(byId["1799000000000000002"].format).toBe("video");
    expect(byId["1799000000000000001"].metrics.shares).toBe(1500);
  });

  it("문자열 배열 media 에서 URL 을 추출한다 (실 actor 형태)", () => {
    const byId = Object.fromEntries(r.posts.map((p) => [p.platformPostId, p]));
    // 여러 이미지 → carousel, mediaUrls 채워짐 (회귀 가드: media 가 문자열 배열)
    expect(byId["1799000000000000001"].mediaUrls).toContain("https://pbs.twimg.com/media/tw1a.jpg");
    expect(byId["1799000000000000001"].mediaUrls.length).toBe(2);
    expect(byId["1799000000000000001"].format).toBe("carousel");
  });
});

describe("tiktok 어댑터", () => {
  const r = getAdapter("tiktok").normalize(ttFixture);

  it("영상 1건 + 팔로워 + 지표를 정규화한다", () => {
    expect(r.posts).toHaveLength(1);
    expect(r.posts[0].format).toBe("video");
    expect(r.posts[0].metrics.views).toBe(2400000);
    expect(r.accountMetric?.followers).toBe(1840000);
  });
});

describe("tiktok-ads 어댑터", () => {
  const r = getAdapter("tiktok_ads").normalize(ttAdsFixture);

  it("광고 2건을 정규화한다 (빈 객체는 무시)", () => {
    expect(r.ads).toHaveLength(2);
    expect(r.posts).toHaveLength(0);
  });

  it("video/image 포맷을 추론한다", () => {
    const byId = Object.fromEntries(r.ads.map((a) => [a.platformAdId, a]));
    expect(byId["tt-ad-0001"].format).toBe("video");
    expect(byId["tt-ad-0002"].format).toBe("image");
  });

  it("landing domain 과 seenActive, 게재일을 추출한다", () => {
    const byId = Object.fromEntries(r.ads.map((a) => [a.platformAdId, a]));
    expect(byId["tt-ad-0001"].landingDomain).toBe("anua.jp");
    expect(byId["tt-ad-0001"].seenActive).toBe(true);
    expect(byId["tt-ad-0001"].startDate).toBe("2026-06-01");
    expect(byId["tt-ad-0002"].seenActive).toBe(false);
    expect(byId["tt-ad-0002"].endDate).toBe("2026-06-10");
    expect(byId["tt-ad-0001"].mediaUrls.length).toBeGreaterThan(0);
  });
});

describe("방어적 파싱", () => {
  it("빈 배열/누락 필드에도 깨지지 않는다", () => {
    expect(getAdapter("meta_ads").normalize([{}, null, 1] as unknown[]).ads).toHaveLength(0);
    expect(getAdapter("instagram").normalize([{}]).posts).toHaveLength(0);
  });
});
