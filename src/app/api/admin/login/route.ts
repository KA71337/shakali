import { NextRequest } from "next/server";
import { z } from "zod";

import { errorJson, json } from "@/lib/api";
import {
  AdminLoginBlockedError,
  assertLoginAllowed,
  clearLoginAttempts,
  createAdminSessionToken,
  isCorrectAdminPassword,
  recordFailedLogin,
  setAdminSessionCookie,
} from "@/lib/auth";
import { hashIdentifier } from "@/lib/crypto";
import { getClientIp, isSameOrigin, readLimitedJson } from "@/lib/request-security";

export const runtime = "nodejs";

const loginSchema = z.object({ password: z.string().min(1).max(500) }).strict();

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return errorJson("INVALID_ORIGIN", "Запрос отклонён.", 403);
  }

  const loginKey = hashIdentifier(getClientIp(request.headers), "ip");
  try {
    await assertLoginAllowed(loginKey);
  } catch (error: unknown) {
    if (error instanceof AdminLoginBlockedError) {
      return errorJson("LOGIN_BLOCKED", error.message, 429, error.retryAfter);
    }
    return errorJson("SERVICE_UNAVAILABLE", "Не удалось выполнить вход.", 503);
  }

  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch {
    return errorJson("INVALID_REQUEST", "Некорректный запрос.", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success || !isCorrectAdminPassword(parsed.data.password)) {
    await recordFailedLogin(loginKey);
    return errorJson("INVALID_CREDENTIALS", "Неверный пароль.", 401);
  }

  await clearLoginAttempts(loginKey);
  const response = json({ ok: true as const });
  setAdminSessionCookie(response, createAdminSessionToken());
  return response;
}
