import "server-only";

import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export function getRateLimitKeys(
  sources: ReadonlyArray<{ ipHash: string; deviceHash: string }>,
): string[] {
  return [
    ...new Set(
      sources.flatMap((source) => [
        `ip:${source.ipHash}`,
        `device:${source.deviceHash}`,
      ]),
    ),
  ];
}

export async function setSourceBlocked(
  sourceKey: string,
  isBlocked: boolean,
): Promise<boolean> {
  return db.$transaction(async (tx: Prisma.TransactionClient) => {
    const source = await tx.source.findUnique({
      where: { sourceKey },
      select: { ipHash: true, deviceHash: true },
    });
    if (!source) return false;

    const relatedSources = await tx.source.findMany({
      where: {
        OR: [{ ipHash: source.ipHash }, { deviceHash: source.deviceHash }],
      },
      select: { sourceKey: true, ipHash: true, deviceHash: true },
    });
    const sourceKeys = relatedSources.map((item) => item.sourceKey);
    const rateLimitKeys = getRateLimitKeys(relatedSources);

    await tx.source.updateMany({
      where: { sourceKey: { in: sourceKeys } },
      data: {
        isBlocked,
        blockedAt: isBlocked ? new Date() : null,
      },
    });

    await tx.rateLimitBucket.updateMany({
      where: { key: { in: rateLimitKeys } },
      data: {
        blockedUntil: isBlocked ? new Date("2100-01-01T00:00:00.000Z") : null,
      },
    });

    if (isBlocked) {
      await tx.message.updateMany({
        where: { sourceKey: { in: sourceKeys } },
        data: { moderationStatus: "blocked" },
      });
    }

    return true;
  });
}
