import type { NextRequest } from "next/server";

/** Public URL for redirects — avoids internal ECS hostnames behind ALB. */
export function getPublicRequestUrl(request: NextRequest | Request): string {
  const { pathname, search } = new URL(request.url);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host =
    forwardedHost?.split(",")[0]?.trim() ?? request.headers.get("host");

  if (host && !host.includes(".internal")) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      "https";
    return `${proto}://${host}${pathname}${search}`;
  }

  if (appUrl) {
    return `${appUrl}${pathname}${search}`;
  }

  return request.url;
}
