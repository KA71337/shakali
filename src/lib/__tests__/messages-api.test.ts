import { afterAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { GET as getFormToken } from "@/app/api/form-token/route";
import { POST as postMessage } from "@/app/api/messages/route";
import { hashIdentifier } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assessRequest, RequestLimitError } from "@/lib/rate-limit";

const TEST_IP = "203.0.113.77";
let sourceKeyToClean: string | null = null;
let ipHashToClean: string | null = null;
let deviceHashToClean: string | null = null;

afterAll(async () => {
  if (sourceKeyToClean && ipHashToClean && deviceHashToClean) {
    await db.$transaction([
      db.message.deleteMany({ where: { sourceKey: sourceKeyToClean } }),
      db.source.deleteMany({ where: { sourceKey: sourceKeyToClean } }),
      db.rateLimitBucket.deleteMany({
        where: { key: { in: [`ip:${ipHashToClean}`, `device:${deviceHashToClean}`] } },
      }),
    ]);
  }
  await db.$disconnect();
});

describe("POST /api/messages", () => {
  it("persists a sanitized message and enforces the server cooldown", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "";
    process.env.TELEGRAM_CHAT_ID = "";
    process.env.TELEGRAM_REQUIRED = "false";

    vi.useFakeTimers();
    const startedAt = new Date("2026-08-09T10:00:00.000Z");
    vi.setSystemTime(startedAt);

    const tokenResponse = await getFormToken(
      new NextRequest("http://localhost:3000/api/form-token", {
        headers: {
          host: "localhost:3000",
          "x-forwarded-for": TEST_IP,
        },
      }),
    );
    const tokenPayload = (await tokenResponse.json()) as { token: string };
    const deviceId = tokenResponse.cookies.get("anon_device")?.value;
    expect(deviceId).toBeTruthy();

    vi.setSystemTime(new Date(startedAt.getTime() + 700));
    const headers = {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      cookie: `anon_device=${deviceId}`,
      "x-forwarded-for": TEST_IP,
      "user-agent":
        "Mozilla/5.0 (Linux; Android 16; Pixel 9 Pro Build/BP2A) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua-model": '"Pixel 9 Pro"',
      "sec-ch-ua-platform": '"Android"',
      "sec-ch-ua-platform-version": '"16.0.0"',
      "sec-ch-ua-mobile": "?1",
    };
    const body = JSON.stringify({
      message: "<b>Тестовое сообщение</b><script>alert(1)</script>",
      formToken: tokenPayload.token,
      website: "",
      turnstileToken: null,
    });

    const firstResponse = await postMessage(
      new NextRequest("http://localhost:3000/api/messages", { method: "POST", headers, body }),
    );
    expect(firstResponse.status).toBe(201);
    expect(await firstResponse.json()).toEqual({ ok: true, retryAfter: 10 });

    const ipHash = hashIdentifier(TEST_IP, "ip");
    const deviceHash = hashIdentifier(deviceId!, "device");
    const sourceKey = hashIdentifier(`${ipHash}:${deviceHash}`, "source");
    sourceKeyToClean = sourceKey;
    ipHashToClean = ipHash;
    deviceHashToClean = deviceHash;

    const stored = await db.message.findFirst({ where: { sourceKey } });
    expect(stored?.message).toBe("Тестовое сообщение");
    expect(stored?.model).toBe("Pixel 9 Pro");
    expect(stored?.telegramStatus).toBe("skipped");

    const secondResponse = await postMessage(
      new NextRequest("http://localhost:3000/api/messages", { method: "POST", headers, body }),
    );
    expect(secondResponse.status).toBe(429);
    const secondPayload = (await secondResponse.json()) as { code: string; retryAfter: number };
    expect(secondPayload.code).toBe("RATE_LIMITED");
    expect(secondPayload.retryAfter).toBe(10);

    const identity = { ipHash, deviceHash, sourceKey };
    for (let requestNumber = 3; requestNumber <= 25; requestNumber += 1) {
      await assessRequest(identity, new Date());
    }
    await expect(assessRequest(identity, new Date())).rejects.toBeInstanceOf(
      RequestLimitError,
    );
    const persistedBlock = await db.rateLimitBucket.findUnique({
      where: { key: `ip:${ipHash}` },
    });
    expect(persistedBlock?.blockedUntil?.getTime()).toBeGreaterThan(Date.now());

    vi.useRealTimers();
  });
});
