import { NextRequest } from "next/server";

import { json } from "@/lib/api";
import { issueFormToken } from "@/lib/form-token";
import { getRequestIdentity } from "@/lib/identity";
import { setDeviceCookie } from "@/lib/request-security";
import { getTurnstileSiteKey } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = getRequestIdentity(request);
  const response = json({
    token: issueFormToken(identity.deviceId),
    turnstileSiteKey: getTurnstileSiteKey(),
  });

  if (identity.isNew) {
    setDeviceCookie(response, identity.deviceId);
  }

  return response;
}
