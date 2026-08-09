import { NextRequest } from "next/server";
import { z } from "zod";

import { errorJson, json } from "@/lib/api";
import { isAdminRequest } from "@/lib/auth";
import { setSourceBlocked } from "@/lib/admin-source-blocking";
import { isSameOrigin, readLimitedJson } from "@/lib/request-security";

const schema = z.object({ sourceKey: z.string().min(20).max(200) }).strict();

async function updateBlockState(request: NextRequest, isBlocked: boolean) {
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

  const found = await setSourceBlocked(parsed.data.sourceKey, isBlocked);
  if (!found) return errorJson("NOT_FOUND", "Источник не найден.", 404);

  return json({ ok: true as const });
}

export async function POST(request: NextRequest) {
  return updateBlockState(request, true);
}

export async function DELETE(request: NextRequest) {
  return updateBlockState(request, false);
}
