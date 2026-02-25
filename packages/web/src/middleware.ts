import { NextRequest, NextResponse } from "next/server";

const JSON_REWRITE_MAP: Record<string, string> = {
  "/": "/_api/status",
  "/challenges": "/_api/challenges",
  "/leaderboard": "/_api/leaderboard",
  "/about": "/_api/about",
  "/protocol": "/_api/protocol",
};

export function middleware(request: NextRequest) {
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("application/json")) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const rewrite = JSON_REWRITE_MAP[path];
  if (!rewrite) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = rewrite;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/", "/challenges", "/leaderboard", "/about", "/protocol"],
};
