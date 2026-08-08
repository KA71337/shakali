import { NextRequest } from "next/server";
import { z } from "zod";

import { errorJson, json } from "@/lib/api";
import { isAdminRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSameOrigin, readLimitedJson } from "@/lib/request-security";

const schema = z.object({ sourceKey: z.string().min(20).max(200) }).strict();

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return errorJson("INVALID_ORIGIN", "Запрос отклонён.", 403);
  if (!isAdminRequest(request)) return errorJson("UNAUTHORIZED", "Требуется авторизация.", 401);

  let body: unknown;
  try {
    body = await readLimitedJson(request);
  } catch {
    return errorJson("INVALID_REQUEST", "Некорректный запрос.", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return errorJson("INVALID_REQUEST", "Некорректный запрос.", 400);

  const source = await db.source.findUnique({ where: { sourceKey: parsed.data.sourceKey } });
  if (!source) return errorJson("NOT_FOUND", "Источник не найден.", 404);

  const relatedSources = await db.source.findMany({
    where: { OR: [{ ipHash: source.ipHash }, { deviceHash: source.deviceHash }] },
    select: { sourceKey: true },
  });
  const sourceKeys = relatedSources.map((item: { sourceKey: string }) => item.sourceKey);
  const blockedUntil = new Date("2100-01-01T00:00:00.000Z");

  await db.$transaction([
    db.source.updateMany({
      where: { sourceKey: { in: sourceKeys } },
      data: { isBlocked: true, blockedAt: new Date() },
    }),
    db.rateLimitBucket.updateMany({
      where: { key: { in: [`ip:${source.ipHash}`, `device:${source.deviceHash}`] } },
      data: { blockedUntil },
    }),
    db.message.updateMany({
      where: { sourceKey: { in: sourceKeys } },
      data: { moderationStatus: "blocked" },
    }),
  ]);

  return json({ ok: true as const });
}
