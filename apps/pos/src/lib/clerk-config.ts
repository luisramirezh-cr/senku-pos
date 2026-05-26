const DEFAULT_HUB_URL = "https://gosenku.com";
const DEFAULT_APP_URL = "https://pos.gosenku.com";

function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function hostnameFromUrl(url: string): string {
  return new URL(url).hostname;
}

export function getClerkHubUrl(): string {
  return normalizeUrl(
    process.env.NEXT_PUBLIC_ROOT_URL ?? DEFAULT_HUB_URL
  );
}

export function getAppUrl(): string {
  return normalizeUrl(process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL);
}

export function getClerkSatelliteDomain(): string {
  return (
    process.env.NEXT_PUBLIC_CLERK_DOMAIN ?? hostnameFromUrl(getAppUrl())
  );
}

export function getClerkSatelliteConfig() {
  const hubUrl = getClerkHubUrl();
  const appUrl = getAppUrl();

  return {
    isSatellite: true as const,
    domain: getClerkSatelliteDomain(),
    signInUrl: `${hubUrl}/sign-in`,
    signUpUrl: `${hubUrl}/sign-up`,
    signInFallbackRedirectUrl: appUrl,
    signUpFallbackRedirectUrl: `${hubUrl}/hub`,
  };
}
