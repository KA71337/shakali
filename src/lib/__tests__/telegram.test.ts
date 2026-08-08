import { afterEach, describe, expect, it, vi } from "vitest";

import { formatTelegramMessage, sendTelegramNotification } from "@/lib/telegram";

const originalToken = process.env.TELEGRAM_BOT_TOKEN;
const originalChatId = process.env.TELEGRAM_CHAT_ID;

afterEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = originalToken;
  process.env.TELEGRAM_CHAT_ID = originalChatId;
  vi.unstubAllGlobals();
});

describe("Telegram formatting", () => {
  it("includes the phone model and escapes Telegram HTML", () => {
    const text = formatTelegramMessage(
      {
        message: "<script>alert('x')</script> & привет",
        ip: "203.0.113.10",
        device: "Android-смартфон",
        browser: "Chrome 151",
        os: "Android 16",
        model: "Pixel 9 Pro <XL>",
        createdAt: new Date("2026-08-08T20:40:00.000Z"),
      },
      "Europe/Moscow",
    );

    expect(text).toContain("📲 <b>Модель:</b> Pixel 9 Pro &lt;XL&gt;");
    expect(text).toContain("&lt;script&gt;");
    expect(text).not.toContain("<script>");
    expect(text).toContain("Chrome 151");
  });

  it("posts a configured notification to Telegram Bot API", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456789:test-token-value";
    process.env.TELEGRAM_CHAT_ID = "987654321";
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(input).toBeTruthy();
        void init;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const status = await sendTelegramNotification({
      message: "Проверка доставки",
      ip: "203.0.113.10",
      device: "Android-смартфон",
      browser: "Chrome 151",
      os: "Android 16",
      model: "Pixel 9 Pro",
      createdAt: new Date("2026-08-08T20:40:00.000Z"),
    });

    expect(status).toBe("delivered");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.telegram.org/bot123456789:test-token-value/sendMessage",
    );
    const payload = JSON.parse(String(options?.body)) as {
      chat_id: string;
      text: string;
      parse_mode: string;
    };
    expect(payload.chat_id).toBe("987654321");
    expect(payload.parse_mode).toBe("HTML");
    expect(payload.text).toContain("Pixel 9 Pro");
  });
});
