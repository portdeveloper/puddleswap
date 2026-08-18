import { describe, expect, it } from "vitest";
import middleware, { APEX_LINK_HEADER, APP_LINK_HEADER } from "../../../../middleware";

function get(url: string, host: string, method = "GET") {
  return middleware(new Request(url, { method, headers: { host } }));
}

/** Parse an RFC 8288 field-value into { target, rel, type } entries. */
function parseLink(value: string) {
  return value.split(/,(?=\s*<)/).map((entry) => {
    const target = entry.match(/^\s*<([^>]+)>/)?.[1] ?? "";
    const params = Object.fromEntries(
      [...entry.matchAll(/;\s*([a-z]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]])
    );
    return { target, rel: params.rel, type: params.type };
  });
}

describe("homepage Link headers", () => {
  it("advertises the three resources on the app homepage", () => {
    const link = get("https://app.puddleswap.org/", "app.puddleswap.org").headers.get("Link");
    expect(link).toBe(APP_LINK_HEADER);
    expect(parseLink(link!)).toEqual([
      { target: "/skill.md", rel: "service-desc", type: "text/markdown" },
      { target: "/llms.txt", rel: "describedby", type: "text/plain" },
      { target: "/learn", rel: "service-doc", type: "text/html" },
    ]);
  });

  it("advertises the absolute /learn target on the apex, which only redirects there", () => {
    const link = get("https://puddleswap.org/", "puddleswap.org").headers.get("Link");
    expect(parseLink(link!)).toEqual([
      { target: "/skill.md", rel: "service-desc", type: "text/markdown" },
      { target: "/llms.txt", rel: "describedby", type: "text/plain" },
      { target: "https://app.puddleswap.org/learn", rel: "service-doc", type: "text/html" },
    ]);
  });

  it("answers HEAD with the same header as GET, on both homepages", () => {
    for (const [url, host, expected] of [
      ["https://app.puddleswap.org/", "app.puddleswap.org", APP_LINK_HEADER],
      ["https://puddleswap.org/", "puddleswap.org", APEX_LINK_HEADER],
    ] as const) {
      expect(get(url, host, "HEAD").headers.get("Link")).toBe(expected);
      expect(get(url, host, "GET").headers.get("Link")).toBe(expected);
    }
  });

  it("treats the www apex through the same branch as the apex", () => {
    expect(get("https://www.puddleswap.org/", "www.puddleswap.org").headers.get("Link")).toBe(
      APEX_LINK_HEADER
    );
  });

  it("never advertises api-catalog: the DEX is static and serves no API catalog", () => {
    for (const value of [APEX_LINK_HEADER, APP_LINK_HEADER]) {
      expect(value).not.toContain("api-catalog");
    }
  });

  it("uses only registered relation types", () => {
    const registered = new Set(["service-desc", "service-doc", "describedby", "alternate"]);
    for (const value of [APEX_LINK_HEADER, APP_LINK_HEADER]) {
      for (const { rel } of parseLink(value)) expect(registered).toContain(rel);
    }
  });

  it("leaves non-homepage paths on the app host untouched", () => {
    for (const path of ["/pools", "/learn", "/llms.txt", "/skill.md"]) {
      const res = get(`https://app.puddleswap.org${path}`, "app.puddleswap.org");
      expect(res.headers.get("Link")).toBeNull();
    }
  });

  it("leaves the apex static files and its redirects untouched", () => {
    expect(get("https://puddleswap.org/llms.txt", "puddleswap.org").headers.get("Link")).toBeNull();
    const redirect = get("https://puddleswap.org/pools", "puddleswap.org");
    expect(redirect.status).toBe(308);
    expect(redirect.headers.get("Link")).toBeNull();
  });

  it("still rewrites the apex homepage to the landing page", () => {
    const res = get("https://puddleswap.org/", "puddleswap.org");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/landing.html");
  });
});
