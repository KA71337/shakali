import { NextRequest } from "next/server";

import { json } from "@/lib/api";
import { issueFormToken } from "@/lib/form-token";
import { getRequestIdentity } from "@/lib/identity";
import { setDeviceCookie } from "@/lib/request-security";
import { getTurnstileSiteKey } from "@/lib/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clientHints =
  "Sec-CH-UA, Sec-CH-UA-Mobile, Sec-CH-UA-Platform, Sec-CH-UA-Model, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness, Sec-CH-UA-Full-Version-List";

export async function GET(request: NextRequest) {
  const identity = getRequestIdentity(request);
  const response = json({
    token: issueFormToken(identity.deviceId),
    turnstileSiteKey: getTurnstileSiteKey(),
  });
  response.headers.set("Accept-CH", clientHints);
  response.headers.set(
    "Critical-CH",
    "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version, Sec-CH-UA-Arch, Sec-CH-UA-Bitness, Sec-CH-UA-Full-Version-List",
  );

  if (identity.isNew) {
    setDeviceCookie(response, identity.deviceId);
  }

  return response;
}
