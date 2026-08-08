import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { acquireTransactionAdvisoryLocks } from "@/lib/advisory-lock";

describe("acquireTransactionAdvisoryLocks", () => {
  it("uses parameterized execute statements in deterministic key order", async () => {
    const executeRaw = vi.fn().mockResolvedValue(1);
    const tx = { $executeRaw: executeRaw } as unknown as Prisma.TransactionClient;

    await acquireTransactionAdvisoryLocks(tx, ["source:z", "device:a", "ip:m"]);

    expect(executeRaw).toHaveBeenCalledTimes(3);
    expect(executeRaw.mock.calls.map(([, key]) => key)).toEqual([
      "device:a",
      "ip:m",
      "source:z",
    ]);
    for (const [statement] of executeRaw.mock.calls) {
      expect(Array.from(statement as TemplateStringsArray).join("$key")).toBe(
        "SELECT pg_advisory_xact_lock(hashtextextended($key, 0))",
      );
    }
  });
});
