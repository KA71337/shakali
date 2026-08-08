import "server-only";

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { hmac, safeEqual } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getServerConfig } from "@/lib/env";
import { ADMIN_COOKIE_NAME } from "@/lib/request-security";

const SESSION_DURATION_SECONDS = 8 * 60 * 60;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_BLOCK_MS = 30 * 60_000;
const MAX_LOGIN_ATTEMPTS = 5;

type SessionPayload = {
  version: 1;
  expiresAt: number;
  nonce: string;
};

export class AdminLoginBlockedError extends Error {
  constructor(public readonly retryAfter: number) {
    super("Слишком много попыток входа. Попробуйте позже.");
  }
}

export function isCorrectAdminPassword(password: string): boolean {
  return safeEqual(password, getServerConfig().adminPassword);
}

export function createAdminSessionToken(now = Date.now()): string {
  const payload: SessionPayload = {
    version: 1,
    expiresAt: now + SESSION_DURATION_SECONDS * 1000,
    nonce: randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(encoded, getServerConfig().adminSessionSecret);
  return `${encoded}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) return false;

  const expected = hmac(encoded, getServerConfig().adminSessionSecret);
  if (!safeEqual(suppliedSignature, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    return (
      typeof payload === "object" &&
      payload !== null &&
      "version" in payload &&
      "expiresAt" in payload &&
      payload.version === 1 &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > now
    );
  } catch {
    return false;
  }
}

export function setAdminSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_COOKIE_NAME)?.value);
}

export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  if (!verifyAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value)) {
    redirect("/admin/login");
  }
}

export async function assertLoginAllowed(key: string, now = new Date()): Promise<void> {
  const attempt = await db.loginAttempt.findUnique({ where: { key } });
  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    throw new AdminLoginBlockedError(
      Math.max(1, Math.ceil((attempt.blockedUntil.getTime() - now.getTime()) / 1000)),
    );
  }
}

export async function recordFailedLogin(key: string, now = new Date()): Promise<void> {
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`login:${key}`}, 0))`;
    const existing = await tx.loginAttempt.findUnique({ where: { key } });
    const windowExpired =
      !existing || now.getTime() - existing.windowStartedAt.getTime() >= LOGIN_WINDOW_MS;
    const attemptCount = windowExpired ? 1 : (existing?.attemptCount ?? 0) + 1;
    const blockedUntil =
      attemptCount >= MAX_LOGIN_ATTEMPTS ? new Date(now.getTime() + LOGIN_BLOCK_MS) : null;

    await tx.loginAttempt.upsert({
      where: { key },
      create: { key, attemptCount, windowStartedAt: now, blockedUntil },
      update: {
        attemptCount,
        windowStartedAt: windowExpired ? now : existing?.windowStartedAt,
        blockedUntil,
      },
    });
  });
}

export async function clearLoginAttempts(key: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { key } });
}
