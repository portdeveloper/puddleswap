export type Part =
  | string
  | { b: string }
  | { code: string }
  | { a: { href: string; text: string } };

export type Block =
  | { type: "p"; parts: Part[] }
  | { type: "h2"; text: string }
  | { type: "ul"; items: { parts: Part[] }[] };

export interface Faq {
  q: string;
  a: string;
}

export interface LearnEntry {
  slug: string;
  title: string;
  description: string;
  h1: string;
  summary: string;
  readingTime: string;
  datePublished: string;
  blocks: Block[];
  faqs?: Faq[];
}

export const learnEntries: LearnEntry[];
export const learnBySlug: Record<string, LearnEntry>;
export function blocksToHtml(blocks: Block[]): string;
