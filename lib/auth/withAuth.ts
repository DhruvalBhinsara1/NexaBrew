import { type NextRequest, NextResponse } from "next/server";
import { getServerUser, type AuthUser, type UserRole } from "@/lib/auth/getServerUser";
import { handleError } from "@/lib/utils/handleError";

/** Next.js dynamic route context (params are synchronous in Next 14). */
export type RouteContext = { params: Record<string, string> };

type AuthedHandler<C extends RouteContext> = (
  req: NextRequest,
  user: AuthUser,
  context: C
) => Promise<NextResponse>;

type WrappedHandler<C extends RouteContext> = (
  req: NextRequest,
  context: C
) => Promise<NextResponse>;

/**
 * Wraps a route handler with authentication and optional role gating.
 * - Resolves the user via getServerUser() and injects it into the handler.
 * - Returns 403 FORBIDDEN if `options.roles` is set and excludes the user.
 * - Routes all thrown errors (AppError/ZodError/unknown) through handleError().
 *
 * Usage:
 *   export const POST = withAuth(async (req, user) => {...}, { roles: ["admin"] });
 */
export function withAuth<C extends RouteContext = RouteContext>(
  handler: AuthedHandler<C>,
  options?: { roles?: UserRole[] }
): WrappedHandler<C> {
  return async (req: NextRequest, context: C): Promise<NextResponse> => {
    try {
      const user = await getServerUser();

      if (options?.roles && !options.roles.includes(user.role)) {
        return NextResponse.json(
          { error: "Forbidden", code: "FORBIDDEN" },
          { status: 403 }
        );
      }

      return await handler(req, user, context);
    } catch (err) {
      // Let Next.js control-flow signals (dynamic-server usage, redirect,
      // notFound) propagate instead of turning them into a 500.
      if (err && typeof err === "object" && "digest" in err) {
        const digest = String((err as { digest: unknown }).digest);
        if (digest === "DYNAMIC_SERVER_USAGE" || digest.startsWith("NEXT_")) {
          throw err;
        }
      }
      return handleError(err);
    }
  };
}
