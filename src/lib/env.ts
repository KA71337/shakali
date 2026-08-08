import "server-only";

function read(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function requirePair(firstName: string, secondName: string): void {
  if (Boolean(read(firstName)) !== Boolean(read(secondName))) {
    throw new Error(`${firstName} and ${secondName} must be configured together`);
  }
}

export function requireSecret(name: string, minimumLength = 32): string {
  const value = read(name);

  if (value.length < minimumLength) {
    throw new Error(`${name} must contain at least ${minimumLength} characters`);
  }

  return value;
}

export function getServerConfig() {
  requirePair("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID");
  requirePair("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY");

  return {
    ipHashSecret: requireSecret("IP_HASH_SECRET"),
    formTokenSecret: requireSecret("FORM_TOKEN_SECRET"),
    adminPassword: requireSecret("ADMIN_PASSWORD", 12),
    adminSessionSecret: requireSecret("ADMIN_SESSION_SECRET"),
    telegramBotToken: read("TELEGRAM_BOT_TOKEN"),
    telegramChatId: read("TELEGRAM_CHAT_ID"),
    telegramRequired: read("TELEGRAM_REQUIRED").toLowerCase() === "true",
    turnstileSiteKey: read("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    turnstileSecretKey: read("TURNSTILE_SECRET_KEY"),
    appTimezone: read("APP_TIMEZONE") || "Europe/Moscow",
    trustedProxyCount: Math.max(0, Number.parseInt(read("TRUSTED_PROXY_COUNT") || "1", 10) || 0),
  } as const;
}
