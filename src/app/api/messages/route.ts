import { NextRequest } from "next/server";
import { z } from "zod";

import { errorJson, json } from "@/lib/api";
import { db } from "@/lib/db";
import { detectDevice } from "@/lib/device";
import { getServerConfig } from "@/lib/env";
import { verifyFormToken } from "@/lib/form-token";
import { getRequestIdentity } from "@/lib/identity";
import {
  assessRequest,
  MESSAGE_COOLDOWN_SECONDS,
  RequestLimitError,
  reserveAndSaveMessage,
} from "@/lib/rate-limit";
import { isSameOrigin, readLimitedJson, setDeviceCookie } from "@/lib/request-security";
import { sanitizeMessage } from "@/lib/sanitize";
import { sendTelegramNotification, TelegramDeliveryError } from "@/lib/telegram";
import { getTurnstileSiteKey, verifyTurnstile } from "@/lib/turnstile";

export const runtime = "nodejs";

const requestSchema = z
  .object({
    message: z.unknown(),
    formToken: z.string().min(1).max(2_000),
    website: z.string().max(200).optional().default(""),
    turnstileToken: z.string().max(4_000).nullable().optional().default(null),
  })
  .strict();

function requestLimitResponse(error: RequestLimitError) {
  const status = error.code === "RATE_LIMITED" ? 429 : 429;
  return errorJson(error.code, error.message, status, error.retryAfter);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return errorJson("INVALID_ORIGIN", "Запрос отклонён.", 403);
  }

  const identity = getRequestIdentity(request);
  let assessment: { captchaRequired: boolean };

  try {
    assessment = await assessRequest(identity);
  } catch (error: unknown) {
    if (error instanceof RequestLimitError) return requestLimitResponse(error);
    console.error("Rate limit assessment failed", error);
    return errorJson("SERVICE_UNAVAILABLE", "Не удалось отправить сообщение. Попробуйте ещё раз.", 503);
  }

  let rawBody: unknown;
  try {
    rawBody = await readLimitedJson(request);
  } catch (error: unknown) {
    const tooLarge = error instanceof Error && error.message === "BODY_TOO_LARGE";
    return errorJson(
      tooLarge ? "BODY_TOO_LARGE" : "INVALID_REQUEST",
      tooLarge
        ? "Сообщение слишком длинное. Максимум — 1000 символов."
        : "Некорректный запрос.",
      tooLarge ? 413 : 400,
    );
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return errorJson("INVALID_REQUEST", "Некорректный запрос.", 400);
  }

  if (parsed.data.website) {
    return errorJson("TOO_MANY_REQUESTS", "Слишком много запросов. Попробуйте позже.", 429, 60);
  }

  const tokenCheck = verifyFormToken(parsed.data.formToken, identity.deviceId);
  if (!tokenCheck.ok) {
    const message =
      tokenCheck.reason === "too_fast"
        ? "Слишком много запросов. Попробуйте позже."
        : "Форма устарела. Обновите страницу и попробуйте снова.";
    return errorJson("INVALID_FORM_TOKEN", message, tokenCheck.reason === "too_fast" ? 429 : 403);
  }

  const validatedMessage = sanitizeMessage(parsed.data.message);
  if (!validatedMessage.ok) {
    return errorJson(validatedMessage.code, validatedMessage.message, 400);
  }

  if (assessment.captchaRequired) {
    const captchaSiteKey = getTurnstileSiteKey();
    if (!captchaSiteKey) {
      return errorJson(
        "TOO_MANY_REQUESTS",
        "Слишком много запросов. Попробуйте позже.",
        429,
        60,
      );
    }

    if (!parsed.data.turnstileToken) {
      const response = json(
        {
          ok: false as const,
          code: "CAPTCHA_REQUIRED",
          message: "Подтвердите, что вы не робот.",
          captchaSiteKey,
        },
        403,
      );
      return response;
    }

    const captchaValid = await verifyTurnstile(parsed.data.turnstileToken, identity.ip);
    if (!captchaValid) {
      return errorJson("CAPTCHA_INVALID", "Проверка не пройдена. Попробуйте ещё раз.", 403);
    }
  }

  const deviceInfo = detectDevice(request.headers);
  const userAgent = (request.headers.get("user-agent") ?? "Не определён")
    .replace(/[\r\n\u0000-\u001F\u007F]/g, "")
    .slice(0, 1_000);

  let storedMessage;
  try {
    storedMessage = await reserveAndSaveMessage({
      message: validatedMessage.message,
      ipHash: identity.ipHash,
      deviceHash: identity.deviceHash,
      sourceKey: identity.sourceKey,
      userAgent,
      ...deviceInfo,
    });
  } catch (error: unknown) {
    if (error instanceof RequestLimitError) return requestLimitResponse(error);
    console.error("Message persistence failed", error);
    return errorJson("SERVICE_UNAVAILABLE", "Не удалось отправить сообщение. Попробуйте ещё раз.", 503);
  }

  try {
    const telegramStatus = await sendTelegramNotification({
      message: storedMessage.message,
      ip: identity.ip,
      device: storedMessage.device,
      browser: storedMessage.browser,
      os: storedMessage.os,
      model: storedMessage.model,
      createdAt: storedMessage.createdAt,
    });
    await db.message.update({
      where: { id: storedMessage.id },
      data: {
        telegramStatus,
        telegramError: null,
        notificationAttempts: { increment: 1 },
      },
    });
  } catch (error: unknown) {
    const safeError = error instanceof TelegramDeliveryError ? error.message.slice(0, 500) : "Unknown error";
    await db.message.update({
      where: { id: storedMessage.id },
      data: {
        telegramStatus: "failed",
        telegramError: safeError,
        notificationAttempts: { increment: 1 },
      },
    });

    console.error("Telegram notification delivery failed");
    if (getServerConfig().telegramRequired) {
      return errorJson(
        "NOTIFICATION_UNAVAILABLE",
        "Сервис уведомлений временно недоступен. Сообщение сохранено.",
        503,
        MESSAGE_COOLDOWN_SECONDS,
      );
    }
  }

  const response = json({ ok: true as const, retryAfter: MESSAGE_COOLDOWN_SECONDS }, 201);
  if (identity.isNew) setDeviceCookie(response, identity.deviceId);
  return response;
}
