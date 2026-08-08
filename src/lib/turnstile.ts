import "server-only";

import { getServerConfig } from "@/lib/env";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
};

export function getTurnstileSiteKey(): string | null {
  const { turnstileSiteKey, turnstileSecretKey } = getServerConfig();
  return turnstileSiteKey && turnstileSecretKey ? turnstileSiteKey : null;
}

export async function verifyTurnstile(token: string, remoteIp: string): Promise<boolean> {
  const { turnstileSiteKey, turnstileSecretKey } = getServerConfig();
  if (!turnstileSiteKey || !turnstileSecretKey || !token) {
    return false;
  }

  const form = new FormData();
  form.set("secret", turnstileSecretKey);
  form.set("response", token);
  if (remoteIp !== "unknown") form.set("remoteip", remoteIp);
  form.set("idempotency_key", crypto.randomUUID());

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileResponse;
    return result.success === true;
  } catch {
    return false;
  }
}
