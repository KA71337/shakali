import "server-only";

import type { Prisma } from "@prisma/client";

export async function acquireTransactionAdvisoryLocks(
  tx: Prisma.TransactionClient,
  keys: readonly string[],
): Promise<void> {
  for (const key of [...keys].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  }
}
