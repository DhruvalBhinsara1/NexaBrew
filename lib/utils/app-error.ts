/**
 * Business-rule / domain error. Thrown by services and auth helpers; mapped to
 * the standard JSON error envelope by handleError() in route handlers.
 * `code` is a stable, machine-readable identifier the frontend can branch on.
 *
 * Kept HTTP-free (no next/server import) so services can import it without
 * pulling in HTTP-layer code (CONSTRAINTS).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = "AppError";
  }
}
