import { NextRequest } from "next/server";

import { errorJson, json } from "@/lib/api";
import { isAdminRequest } from "@/lib/auth";
import { db } from "@/lib/db";
import { isSameOrigin } from "@/lib/request-security";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!isSameOrigin(request)) return errorJson("INVALID_ORIGIN", "Запрос отклонён.", 403);
  if (!isAdminRequest(request)) return errorJson("UNAUTHORIZED", "Требуется авторизация.", 401);

  const { id } = await context.params;
  if (!id || id.length > 100) return errorJson("INVALID_ID", "Некорректный идентификатор.", 400);

  const result = await db.message.deleteMany({ where: { id } });
  if (result.count === 0) return errorJson("NOT_FOUND", "Сообщение не найдено.", 404);
  return json({ ok: true as const });
}
