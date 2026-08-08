import { NextRequest } from "next/server";

import { json, errorJson } from "@/lib/api";
import { clearAdminSessionCookie } from "@/lib/auth";
import { isSameOrigin } from "@/lib/request-security";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return errorJson("INVALID_ORIGIN", "Запрос отклонён.", 403);
  }

  const response = json({ ok: true as const });
  clearAdminSessionCookie(response);
  return response;
}
