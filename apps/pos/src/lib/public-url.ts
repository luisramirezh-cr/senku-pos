import type { NextRequest } from "next/server";

function getAppOrigin(): string {
  const fromEnv =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "";
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const root = process.env.NEXT_PUBLIC_ROOT_URL ?? "";
  if (root.includes("root-dev")) {
    return "https://pos-dev.gosenku.com";
  }

  return "https://pos.gosenku.com";
}

function isInternalHost(hostname: string): boolean {
  return (
    hostname.includes(".internal") ||
    hostname.startsWith("ip-") ||
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  );
}

/** Public URL for redirects — avoids internal ECS hostnames behind ALB. */
export function getPublicRequestUrl(request: NextRequest | Request): string {
  const parsed = new URL(request.url);
  const appOrigin = getAppOrigin();

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host =
    forwardedHost?.split(",")[0]?.trim() ??
    request.headers.get("host")?.split(":")[0] ??
    parsed.hostname;

  if (host && !isInternalHost(host)) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
      "https";
    return `${proto}://${host}${parsed.pathname}${parsed.search}`;
  }

  if (isInternalHost(parsed.hostname)) {
    return `${appOrigin}${parsed.pathname}${parsed.search}`;
  }

  return request.url;
}
