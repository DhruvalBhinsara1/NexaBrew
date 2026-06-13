import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/utils/app-error";

export { AppError };

type ErrorBody = {
  error: string;
  code: string;
  details?: Record<string, string[]>;
};

/**
 * Unified error → JSON response formatter. Use in every route handler's catch
 * block. Maps AppError and ZodError to the standard error envelope and treats
 * everything else as a 500 (logged via console.error).
 */
export function handleError(err: unknown): NextResponse<ErrorBody> {
  if (err instanceof AppError) {
    const body: ErrorBody = { error: err.message, code: err.code };
    if (err.details) body.details = err.details;
    return NextResponse.json(body, { status: err.status });
  }

  if (err instanceof ZodError) {
    // Build field errors from `issues` — stable across Zod 3/4.
    const details: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
      (details[key] ??= []).push(issue.message);
    }
    return NextResponse.json(
      { error: "Validation failed", code: "VALIDATION_ERROR", details },
      { status: 400 }
    );
  }

  console.error("[handleError] Unhandled error:", err);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}
