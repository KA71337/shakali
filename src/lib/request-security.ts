import "server-only";

import { isIP } from "node:net";
import { randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

import { getServerConfig } from "@/lib/env";

export const DEVICE_COOKIE_NAME = "anon_device";
export const ADMIN_COOKIE_NAME = "anon_admin";
export const MAX_REQUEST_BYTES = 4_096;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeIp(candidate: string | undefined): string | null {
  if (!candidate) return null;
  let value = candidate.trim();

  if (value.startsWith("[") && value.includes("]")) {
    value = value.slice(1, value.indexOf("]"));
  } else if (value.includes(":") && value.includes(".") && value.lastIndexOf(":") > value.lastIndexOf(".")) {
    value = value.slice(0, value.lastIndexOf(":"));
  }

  return isIP(value) ? value : null;
}

export function getClientIp(headers: Headers): string {
  const cloudflareIp = headers.has("cf-ray")
    ? normalizeIp(headers.get("cf-connecting-ip") ?? undefined)
    : null;
  if (cloudflareIp) return cloudflareIp;

  const vercelIp = headers.has("x-vercel-id")
    ? normalizeIp((headers.get("x-vercel-forwarded-for") ?? "").split(",")[0])
    : null;
  if (vercelIp) return vercelIp;

  const { trustedProxyCount } = getServerConfig();
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((part) => normalizeIp(part))
    .filter((part): part is string => part !== null);

  if (trustedProxyCount > 0 && forwarded.length > 0) {
    const index = Math.max(0, forwarded.length - trustedProxyCount);
    return forwarded[index] ?? forwarded[0];
  }

  const realIp = trustedProxyCount > 0
    ? normalizeIp(headers.get("x-real-ip") ?? undefined)
    : null;
  return realIp ?? "unknown";
}

export function getOrCreateDeviceId(request: NextRequest): { deviceId: string; isNew: boolean } {
  const existing = request.cookies.get(DEVICE_COOKIE_NAME)?.value;
  if (existing && UUID_PATTERN.test(existing)) {
    return { deviceId: existing, isNew: false };
  }

  return { deviceId: randomUUID(), isNew: true };
}

export function setDeviceCookie(response: NextResponse, deviceId: string): void {
  response.cookies.set(DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (!origin || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site")) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const expectedHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return originUrl.host === expectedHost;
  } catch {
    return false;
  }
}

export async function readLimitedJson(request: NextRequest): Promise<unknown> {
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > MAX_REQUEST_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}
