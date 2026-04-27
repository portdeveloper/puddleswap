import type { Block, Faq } from "./learn.d.mts";

export interface SwapToken {
  symbol: string;
  name: string;
  slug: string;
  isNative: boolean;
  isStable?: boolean;
  description: string;
}

export type SwapCategory =
  | "native-to-stable"
  | "stable-to-native"
  | "wmon-to-stable"
  | "stable-to-wmon"
  | "stable-pair";

export interface SwapPair {
  slug: string;
  from: SwapToken;
  to: SwapToken;
  category: SwapCategory;
  title: string;
  description: string;
  h1: string;
  summary: string;
  readingTime: string;
  datePublished: string;
  blocks: Block[];
  faqs: Faq[];
}

export const SWAP_GUIDES_BASE_PATH: string;
export const swapPairs: SwapPair[];
export const swapPairBySlug: Record<string, SwapPair>;
export function swapBlocksToHtml(blocks: Block[]): string;
