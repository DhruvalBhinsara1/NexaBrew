// Standard API envelope (CLAUDE.md "API Response Shape").

export interface ApiSuccess<T> {
  data: T;
  meta?: { total?: number };
}

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function isApiError<T>(res: ApiResponse<T>): res is ApiError {
  return "error" in res;
}
