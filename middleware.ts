import { rewrite, next } from "@vercel/edge";

const APEX_STATIC_FILES = new Set([
  "/favicon.ico",
  "/favicon.svg",
  "/favicon-16.png",
  "/favicon-32.png",
  "/favicon-48.png",
  "/favicon-96.png",
  "/favicon-192.png",
  "/apple-touch-icon.png",
  "/og.png",
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/skill.md",
]);

// RFC 8288 relations for the machine-readable resources the homepages already
// serve, so an agent can find them from the response headers instead of having
// to guess the paths. Registered relation types only (RFC 8631 service-desc and
// service-doc, plus describedby), and deliberately no api-catalog: PuddleSwap is
// static and backend-free, so it publishes no HTTP API catalog to point at.
const SHARED_LINKS = [
  '</skill.md>; rel="service-desc"; type="text/markdown"',
  '</llms.txt>; rel="describedby"; type="text/plain"',
];

// The apex serves /skill.md and /llms.txt itself, but /learn only as a 308 to
// the app host, so it advertises the absolute target: an advertised link should
// resolve directly rather than send the agent through a redirect first.
export const APEX_LINK_HEADER = SHARED_LINKS.concat(
  '<https://app.puddleswap.org/learn>; rel="service-doc"; type="text/html"',
).join(", ");

export const APP_LINK_HEADER = SHARED_LINKS.concat(
  '</learn>; rel="service-doc"; type="text/html"',
).join(", ");

export const config = {
  matcher: "/((?!assets/|fonts/).*)",
};

export default function middleware(request: Request) {
  const host = request.headers.get("host") ?? "";
  const url = new URL(request.url);
  const isApex = host === "puddleswap.org" || host === "www.puddleswap.org";

  if (url.pathname === "/landing.html") {
    if (isApex) {
      return Response.redirect(new URL("/", request.url).toString(), 308);
    }
    return Response.redirect("https://app.puddleswap.org/", 308);
  }

  if (!isApex) {
    // Only the homepage advertises the links; every other path on the app host
    // is left exactly as it was.
    return url.pathname === "/"
      ? next({ headers: { Link: APP_LINK_HEADER } })
      : next();
  }

  if (url.pathname === "/") {
    return rewrite(new URL("/landing.html", request.url), {
      headers: { Link: APEX_LINK_HEADER },
    });
  }

  if (APEX_STATIC_FILES.has(url.pathname)) return next();

  const target = new URL(url.pathname + url.search, "https://app.puddleswap.org");
  return Response.redirect(target.toString(), 308);
}
