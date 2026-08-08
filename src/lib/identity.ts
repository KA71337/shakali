import "server-only";

import type { NextRequest } from "next/server";

import { hashIdentifier } from "@/lib/crypto";
import { getClientIp, getOrCreateDeviceId } from "@/lib/request-security";

export function getRequestIdentity(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const { deviceId, isNew } = getOrCreateDeviceId(request);
  const ipHash = hashIdentifier(ip, "ip");
  const deviceHash = hashIdentifier(deviceId, "device");
  const sourceKey = hashIdentifier(`${ipHash}:${deviceHash}`, "source");

  return { ip, deviceId, isNew, ipHash, deviceHash, sourceKey };
}
