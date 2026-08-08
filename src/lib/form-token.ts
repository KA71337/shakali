import "server-only";

import { randomUUID } from "node:crypto";

import { hmac, safeEqual } from "@/lib/crypto";
import { getServerConfig } from "@/lib/env";

const TOKEN_VERSION = 1;
const MIN_TOKEN_AGE_MS = 650;
const MAX_TOKEN_AGE_MS = 2 * 60 * 60 * 1000;

type FormTokenPayload = {
  v: number;
  deviceId: string;
  issuedAt: number;
  nonce: string;
};

export type FormTokenVerification =
  | { ok: true }
  | { ok: false; reason: "invalid" | "too_fast" | "expired" };

export function issueFormToken(deviceId: string, now = Date.now()): string {
  const payload: FormTokenPayload = {
    v: TOKEN_VERSION,
    deviceId,
    issuedAt: now,
    nonce: randomUUID(),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(encoded, getServerConfig().formTokenSecret);
  return `${encoded}.${signature}`;
}

export function verifyFormToken(
  token: string,
  deviceId: string,
  now = Date.now(),
): FormTokenVerification {
  const [encoded, suppliedSignature, extra] = token.split(".");

  if (!encoded || !suppliedSignature || extra) {
    return { ok: false, reason: "invalid" };
  }

  const expectedSignature = hmac(encoded, getServerConfig().formTokenSecret);
  if (!safeEqual(suppliedSignature, expectedSignature)) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("v" in parsed) ||
      !("deviceId" in parsed) ||
      !("issuedAt" in parsed) ||
      parsed.v !== TOKEN_VERSION ||
      parsed.deviceId !== deviceId ||
      typeof parsed.issuedAt !== "number" ||
      !Number.isFinite(parsed.issuedAt)
    ) {
      return { ok: false, reason: "invalid" };
    }

    const age = now - parsed.issuedAt;
    if (age < MIN_TOKEN_AGE_MS) {
      return { ok: false, reason: "too_fast" };
    }
    if (age > MAX_TOKEN_AGE_MS || age < -5_000) {
      return { ok: false, reason: "expired" };
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
