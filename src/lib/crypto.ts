import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { getServerConfig } from "@/lib/env";

export function hmac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function hashIdentifier(value: string, purpose: "ip" | "device" | "source"): string {
  const { ipHashSecret } = getServerConfig();
  return hmac(`${purpose}:${value}`, ipHashSecret);
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    timingSafeEqual(leftBuffer, leftBuffer);
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
