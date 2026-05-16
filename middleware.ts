import { rewrite, next } from "@vercel/edge";

const APEX_STATIC_FILES = new Set([
  "/favicon.svg",
  "/og.png",
  "/robots.txt",
  "/sitemap.xml",
]);

export const config = {
  matcher: "/((?!assets/).*)",
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

  if (!isApex) return next();

  if (url.pathname === "/") {
    return rewrite(new URL("/landing.html", request.url));
  }

  if (APEX_STATIC_FILES.has(url.pathname)) return next();

  const target = new URL(url.pathname + url.search, "https://app.puddleswap.org");
  return Response.redirect(target.toString(), 308);
}
