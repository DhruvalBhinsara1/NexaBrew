import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type UserRole = "admin" | "employee";

const AUTH_PATHS = ["/login", "/signup"];

function homeForRole(role: UserRole): string {
  return role === "admin" ? "/dashboard" : "/pos/terminal";
}

/**
 * Route protection (DECISION-009: /kds is public).
 *  - Unauthenticated → redirected to /login (except auth + public pages).
 *  - Authenticated on an auth page → redirected to their role home.
 *  - Employee hitting /dashboard/* → redirected to /pos/terminal.
 * /api/* is excluded via the matcher; route handlers self-guard with withAuth().
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const path = request.nextUrl.pathname;

  // Public Kitchen Display — no auth.
  if (path === "/kds" || path.startsWith("/kds/")) {
    return response;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthPath = AUTH_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  // Carry refreshed session cookies through any redirect we issue.
  const redirectTo = (pathname: string): NextResponse => {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!user) {
    return isAuthPath ? response : redirectTo("/login");
  }

  // Authenticated: resolve role from public.users (source of truth).
  const { data: profile } = await supabase
    .from("users")
    .select("role, is_archived")
    .eq("id", user.id)
    .maybeSingle();

  const typedProfile = profile as { role: UserRole; is_archived: boolean } | null;

  if (!typedProfile || typedProfile.is_archived) {
    return isAuthPath ? response : redirectTo("/login");
  }

  const role: UserRole = typedProfile.role;

  if (isAuthPath || path === "/") {
    return redirectTo(homeForRole(role));
  }

  if ((path === "/dashboard" || path.startsWith("/dashboard/")) && role !== "admin") {
    return redirectTo("/pos/terminal");
  }

  return response;
}

export const config = {
  matcher: [
    // Run on everything except API routes, Next internals, and static assets.
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
