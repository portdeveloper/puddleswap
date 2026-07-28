import { describe, expect, it } from "vitest";

import { buildCandidateRoutes, selectBestQuote } from "../routing";

describe("buildCandidateRoutes", () => {
  it("creates direct, single-core, and two-core routes without duplicates", () => {
    const a = "0x0000000000000000000000000000000000000001";
    const b = "0x0000000000000000000000000000000000000002";
    const c1 = "0x0000000000000000000000000000000000000003";
    const c2 = "0x0000000000000000000000000000000000000004";
    const c3 = "0x0000000000000000000000000000000000000005";

    const routes = buildCandidateRoutes(a, b, [c1, c2, c3]);

    expect(routes).toContainEqual([a, b]);
    expect(routes).toContainEqual([a, c1, b]);
    expect(routes).toContainEqual([a, c2, b]);
    expect(routes).toContainEqual([a, c1, c2, b]);
    expect(routes).toContainEqual([a, c2, c1, b]);

    const dedupeSet = new Set(routes.map((route) => route.join("-")));
    expect(dedupeSet.size).toBe(routes.length);
  });
});

describe("selectBestQuote", () => {
  it("returns the max amountOut among successful candidates", () => {
    const best = selectBestQuote([
      {
        path: [
          "0x0000000000000000000000000000000000000001",
          "0x0000000000000000000000000000000000000002"
        ],
        amountOut: 100n,
        success: true
      },
      {
        path: [
          "0x0000000000000000000000000000000000000001",
          "0x0000000000000000000000000000000000000003",
          "0x0000000000000000000000000000000000000002"
        ],
        amountOut: 150n,
        success: true
      },
      {
        path: [
          "0x0000000000000000000000000000000000000001",
          "0x0000000000000000000000000000000000000004",
          "0x0000000000000000000000000000000000000002"
        ],
        amountOut: 200n,
        success: false
      }
    ]);

    expect(best?.amountOut).toBe(150n);
  });
});
