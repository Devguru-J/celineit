import type { Platform } from "@celine/shared";
import { instagramAdapter } from "./instagram";
import { metaAdsAdapter } from "./meta-ads";
import { tiktokAdapter } from "./tiktok";
import { twitterAdapter } from "./twitter";
import type { PlatformAdapter } from "./types";

export const ADAPTERS: Record<Platform, PlatformAdapter> = {
  meta_ads: metaAdsAdapter,
  instagram: instagramAdapter,
  twitter: twitterAdapter,
  tiktok: tiktokAdapter,
};

export function getAdapter(platform: Platform): PlatformAdapter {
  return ADAPTERS[platform];
}

export type { PlatformAdapter, AccountInput } from "./types";
