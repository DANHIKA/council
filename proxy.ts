import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccessRoute } from "@/lib/rbac";
import type { UserRole } from "@/lib/types";

// Routes that are publicly accessible (no auth required)
const PUBLIC_ROUTES = ["/auth/login", "/auth/error", "/api/auth"];

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes through
    if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
        return NextResponse.next();
    }

    // Skip Next.js internals and static files
    if (
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // Decode JWT from the request
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

    // Not authenticated → redirect to login
    if (!token) {
        const loginUrl = new URL("/auth/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    const role = token.role as UserRole | undefined;

    // Role cannot access this route → redirect to their default landing page
    if (!canAccessRoute(role, pathname)) {
        const forbidden = new URL(getDefaultRoute(role), request.url);
        return NextResponse.redirect(forbidden);
    }

    return NextResponse.next();
}

function getDefaultRoute(role: UserRole | undefined): string {
    switch (role) {
        case "ADMIN":
        case "OFFICER":
            return "/officer/applications";
        default:
            return "/dashboard";
    }
}

export const config = {
    // Run on all routes except static assets and API
    matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
