import "server-only";

import { getServerConfig } from "@/lib/env";

export type TelegramNotification = {
  message: string;
  ip: string;
  device: string;
  browser: string;
  os: string;
  model: string | null;
  createdAt: Date;
};

export class TelegramDeliveryError extends Error {}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function formatTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTelegramMessage(input: TelegramNotification, timeZone: string): string {
  const model = input.model ?? "Не раскрыта браузером";

  return [
    "🔔 <b>Новое анонимное сообщение</b>",
    "",
    "💬 <b>Сообщение:</b>",
    `<blockquote>${escapeHtml(input.message)}</blockquote>`,
    "",
    `📱 <b>Устройство:</b> ${escapeHtml(input.device)}`,
    `📲 <b>Модель:</b> ${escapeHtml(model)}`,
    `🌐 <b>Браузер:</b> ${escapeHtml(input.browser)}`,
    `💻 <b>ОС:</b> ${escapeHtml(input.os)}`,
    `🕐 <b>Время:</b> ${escapeHtml(formatTime(input.createdAt, timeZone))}`,
    `🌍 <b>IP:</b> <code>${escapeHtml(input.ip)}</code>`,
  ].join("\n");
}

export async function sendTelegramNotification(
  input: TelegramNotification,
): Promise<"delivered" | "skipped"> {
  const config = getServerConfig();
  const configured = Boolean(config.telegramBotToken && config.telegramChatId);

  if (!configured) {
    if (config.telegramRequired) {
      throw new TelegramDeliveryError("Telegram integration is required but not configured");
    }
    return "skipped";
  }

  const endpoint = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
  const body = {
    chat_id: config.telegramChatId,
    text: formatTelegramMessage(input, config.appTimezone),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };

  let lastError = "Telegram request failed";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const result = (await response.json().catch(() => null)) as
        | { ok?: boolean; description?: string }
        | null;

      if (response.ok && result?.ok === true) {
        return "delivered";
      }

      lastError = result?.description || `Telegram returned HTTP ${response.status}`;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) break;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : lastError;
    }

    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
  }

  throw new TelegramDeliveryError(lastError);
}
