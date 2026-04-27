import type { Block, Faq } from "./learn.mjs";

export interface TokenEntry {
  slug: string;
  symbol: string;
  name: string;
  address: string | null;
  decimals: number;
  isNative: boolean;
  isCore: boolean;
  title: string;
  description: string;
  h1: string;
  summary: string;
  blocks: Block[];
  faqs?: Faq[];
}

export const TOKENS_BASE_PATH: string;
export const tokenEntries: TokenEntry[];
export const tokenBySlug: Record<string, TokenEntry>;
export function tokenBlocksToHtml(blocks: Block[]): string;
