import type { NextResponse } from "next/server";
import { NextResponse as Response } from "next/server";

export function json<T>(body: T, status = 200): NextResponse<T> {
  const response = Response.json(body, { status });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function errorJson(code: string, message: string, status: number, retryAfter?: number) {
  const response = json(
    {
      ok: false as const,
      code,
      message,
      ...(retryAfter === undefined ? {} : { retryAfter }),
    },
    status,
  );

  if (retryAfter !== undefined) {
    response.headers.set("Retry-After", String(Math.max(1, Math.ceil(retryAfter))));
  }

  return response;
}
