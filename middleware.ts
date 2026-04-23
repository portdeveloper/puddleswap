import { rewrite, next } from "@vercel/edge";

export const config = { matcher: "/" };

export default function middleware(request: Request) {
  const host = request.headers.get("host") ?? "";
  if (host === "puddleswap.org" || host === "www.puddleswap.org") {
    return rewrite(new URL("/landing.html", request.url));
  }
  return next();
}
