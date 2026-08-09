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

  it("sends an image and the complete long message through both Telegram endpoints", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456789:test-token-value";
    process.env.TELEGRAM_CHAT_ID = "987654321";
    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(() =>
      Promise.resolve(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const longMessage = "Длинное сообщение ".repeat(60);

    const status = await sendTelegramNotification({
      message: longMessage,
      imageData: Uint8Array.from([0xff, 0xd8, 0xff]),
      imageMime: "image/jpeg",
      ip: "203.0.113.10",
      device: "Смартфон",
      browser: "Chrome",
      os: "Android",
      model: null,
      createdAt: new Date("2026-08-08T20:40:00.000Z"),
    });

    expect(status).toBe("delivered");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [photoUrl, photoOptions] = fetchMock.mock.calls[0];
    expect(photoUrl).toContain("/sendPhoto");
    expect(photoOptions?.body).toBeInstanceOf(FormData);
    const photoBody = photoOptions?.body as FormData;
    expect(photoBody.get("chat_id")).toBe("987654321");
    expect(photoBody.get("caption")).toBeNull();
    expect(photoBody.get("photo")).toBeInstanceOf(File);

    const [messageUrl, messageOptions] = fetchMock.mock.calls[1];
    expect(messageUrl).toContain("/sendMessage");
    const messageBody = JSON.parse(String(messageOptions?.body)) as { text: string };
    expect(messageBody.text.length).toBeGreaterThan(1_024);
    expect(messageBody.text).toContain(longMessage);
    expect(messageBody.text).toContain("203.0.113.10");
  });

  it("fails image delivery unless both Telegram calls succeed", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456789:test-token-value";
    process.env.TELEGRAM_CHAT_ID = "987654321";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false, description: "message rejected" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTelegramNotification({
        message: "Фото",
        imageData: Uint8Array.from([0xff, 0xd8, 0xff]),
        imageMime: "image/jpeg",
        ip: "203.0.113.10",
        device: "Смартфон",
        browser: "Chrome",
        os: "Android",
        model: null,
        createdAt: new Date("2026-08-08T20:40:00.000Z"),
      }),
    ).rejects.toThrow("message rejected");
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
