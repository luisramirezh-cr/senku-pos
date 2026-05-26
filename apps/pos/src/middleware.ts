import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getClerkHubUrl } from "@/lib/clerk-config";

const isPublicRoute = createRouteMatcher(["/api/health"]);

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { userId, sessionClaims } = await auth();
  const response = NextResponse.next();

  if (isPublicRoute(request)) return response;

  const rootUrl = getClerkHubUrl();

  if (!userId) {
    const signInUrl = new URL(`${rootUrl}/sign-in`);
    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://pos-dev.gosenku.com"}${request.nextUrl.pathname}${request.nextUrl.search}`;
    signInUrl.searchParams.set("redirect_url", returnUrl);
    return NextResponse.redirect(signInUrl);
  }

  const role = (sessionClaims?.publicMetadata as Record<string, string>)?.role;
  if (role !== "business" && role !== "superadmin" && role !== "cashier") {
    return NextResponse.redirect(new URL(`${rootUrl}/hub`));
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|woff2?|ttf|otf)$).*)",
  ],
};
