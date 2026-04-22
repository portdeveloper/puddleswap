import type { CSSProperties } from "react";

type TokenIconProps = {
  symbol: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

function normalize(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s === "tusdt" || s === "usdt") return "usdt";
  if (s === "usdc") return "usdc";
  if (s === "mon") return "mon";
  if (s === "wmon") return "wmon";
  return "";
}

function UsdcMark() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="USDC">
      <circle cx="16" cy="16" r="16" fill="#2775CA" />
      <path
        fill="#FFF"
        d="M20.5 18.25c0-2.43-1.46-3.27-4.38-3.62-2.08-.28-2.5-.83-2.5-1.8s.7-1.59 2.08-1.59c1.25 0 1.95.42 2.29 1.45a.52.52 0 0 0 .49.35h1.11c.28 0 .49-.21.49-.49v-.07c-.28-1.52-1.52-2.71-3.12-2.85V7.91c0-.28-.21-.49-.56-.56h-1.04c-.28 0-.49.21-.56.56v1.6c-2.08.28-3.4 1.66-3.4 3.4 0 2.29 1.38 3.19 4.3 3.54 1.94.35 2.57.76 2.57 1.87s-.97 1.87-2.29 1.87c-1.8 0-2.43-.76-2.64-1.8a.52.52 0 0 0-.49-.41h-1.18c-.28 0-.49.21-.49.49v.07c.28 1.73 1.38 2.98 3.68 3.33v1.66c0 .28.21.49.56.56h1.04c.28 0 .49-.21.56-.56V22c2.08-.35 3.47-1.8 3.47-3.68z"
      />
      <path
        fill="#FFF"
        d="M12.6 25.38c-5.28-1.94-7.98-7.84-5.97-13.04 1.04-2.91 3.33-5.14 5.97-6.18a.65.65 0 0 0 .41-.69v-.9a.47.47 0 0 0-.41-.56c-.07 0-.21 0-.28.07C5.94 5.99 2.47 12.78 4.48 19.17c1.18 3.75 4.09 6.67 7.84 7.84a.48.48 0 0 0 .62-.28c.07-.07.07-.14.07-.28v-.9a.58.58 0 0 0-.41-.56zM19.47 2.62a.48.48 0 0 0-.62.28c-.07.07-.07.14-.07.28v.9c0 .28.21.56.41.69 5.28 1.94 7.98 7.84 5.97 13.04-1.04 2.91-3.33 5.14-5.97 6.18a.65.65 0 0 0-.41.69v.9a.47.47 0 0 0 .41.56c.07 0 .21 0 .28-.07 6.39-2 9.86-8.81 7.84-15.2-1.18-3.82-4.16-6.74-7.84-7.91z"
      />
    </svg>
  );
}

function UsdtMark() {
  return (
    <svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="USDT">
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        fill="#FFF"
        d="M17.92 17.38v0c-.11.01-.68.04-1.94.04-1.01 0-1.72-.03-1.97-.04v0c-3.89-.17-6.79-.85-6.79-1.66s2.9-1.49 6.79-1.66v2.64c.25.02.98.06 1.99.06 1.21 0 1.81-.05 1.92-.06V14.1c3.88.17 6.78.85 6.78 1.66s-2.9 1.49-6.78 1.66m0-3.59v-2.37h5.41V7.82H8.6v3.61h5.41v2.36c-4.4.2-7.71 1.07-7.71 2.12s3.31 1.92 7.71 2.12v7.58h3.91V18.03c4.39-.2 7.69-1.07 7.69-2.12s-3.3-1.91-7.69-2.12"
      />
    </svg>
  );
}

function MonMark({ wrapped = false }: { wrapped?: boolean }) {
  return (
    <svg viewBox="0 0 182 184" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={wrapped ? "WMON" : "MON"}>
      <circle cx="91" cy="92" r="91" fill="#836EF9" />
      <g transform="translate(91 91.76) scale(0.82) translate(-91 -91.76)">
        <path
          fillRule="evenodd"
          fill="#FFFFFF"
          d="M90.5358 0C64.3911 0 0 65.2598 0 91.7593C0 118.259 64.3911 183.52 90.5358 183.52C116.681 183.52 181.073 118.258 181.073 91.7593C181.073 65.2609 116.682 0 90.5358 0ZM76.4273 144.23C65.4024 141.185 35.7608 88.634 38.7655 77.4599C41.7703 66.2854 93.62 36.2439 104.645 39.2892C115.67 42.3341 145.312 94.8846 142.307 106.059C139.302 117.234 87.4522 147.276 76.4273 144.23Z"
        />
      </g>
      {wrapped && (
        <circle
          cx="91"
          cy="92"
          r="82"
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.6"
          strokeWidth="6"
          strokeDasharray="10 12"
        />
      )}
    </svg>
  );
}

function FallbackMark({ symbol }: { symbol: string }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        background: "var(--nav-dark)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: "0.5em",
      }}
    >
      {symbol.charAt(0).toUpperCase()}
    </div>
  );
}

export function TokenIcon({ symbol, size = 28, className, style }: TokenIconProps) {
  const kind = normalize(symbol);

  const box: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: size,
    lineHeight: 0,
    ...style,
  };

  let mark;
  if (kind === "usdc") mark = <UsdcMark />;
  else if (kind === "usdt") mark = <UsdtMark />;
  else if (kind === "mon") mark = <MonMark />;
  else if (kind === "wmon") mark = <MonMark wrapped />;
  else mark = <FallbackMark symbol={symbol} />;

  return (
    <span className={className} style={box}>
      {mark}
    </span>
  );
}
