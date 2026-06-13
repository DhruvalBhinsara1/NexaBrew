"use client";

/**
 * Thin client-side fetch wrapper for the NexaBrew API.
 * Unwraps the `{ data }` success envelope and throws on `{ error }`.
 */

interface ApiError extends Error {
  code?: string;
  status?: number;
}

async function parse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = new Error(json.error ?? `Request failed (${res.status})`);
    err.code = json.code;
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  return parse<T>(await fetch(url, { cache: "no-store" }));
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown
): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  );
}
