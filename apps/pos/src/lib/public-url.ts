import type { NextRequest } from "next/server";

function getAppOrigin(): string {
  const fromEnv =
    process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  const root = process.env.NEXT_PUBLIC_ROOT_URL ?? "";
  if (root.includes("root-dev")) {
    return "https://pos-dev.gosenku.com";
  }

  return "https://pos.gosenku.com";
}

/** Public URL for redirects — always uses the configured app origin. */
export function getPublicRequestUrl(request: NextRequest): string {
  const origin = getAppOrigin();
  return `${origin}${request.nextUrl.pathname}${request.nextUrl.search}`;
}
