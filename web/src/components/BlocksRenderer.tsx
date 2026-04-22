import { Fragment } from "react";
import { Link } from "react-router-dom";

import type { Block, Part } from "../content/learn.mjs";

function renderParts(parts: Part[]) {
  return parts.map((part, i) => {
    if (typeof part === "string") return <Fragment key={i}>{part}</Fragment>;
    if ("b" in part) return <strong key={i}>{part.b}</strong>;
    if ("code" in part)
      return (
        <code key={i} translate="no">
          {part.code}
        </code>
      );
    if ("a" in part) {
      const isInternal = part.a.href.startsWith("/");
      return isInternal ? (
        <Link key={i} to={part.a.href}>
          {part.a.text}
        </Link>
      ) : (
        <a key={i} href={part.a.href} target="_blank" rel="noopener noreferrer">
          {part.a.text}
        </a>
      );
    }
    return null;
  });
}

function renderBlock(block: Block, i: number) {
  if (block.type === "p") return <p key={i}>{renderParts(block.parts)}</p>;
  if (block.type === "h2") return <h2 key={i}>{block.text}</h2>;
  if (block.type === "ul")
    return (
      <ul key={i}>
        {block.items.map((item, j) => (
          <li key={j}>{renderParts(item.parts)}</li>
        ))}
      </ul>
    );
  return null;
}

export function BlocksRenderer({ blocks }: { blocks: Block[] }) {
  return <>{blocks.map((block, i) => renderBlock(block, i))}</>;
}
