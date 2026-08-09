import { describe, expect, it } from "vitest";

import { getRateLimitKeys } from "@/lib/admin-source-blocking";

describe("admin source blocking", () => {
  it("deduplicates rate-limit keys for all affected sources", () => {
    expect(
      getRateLimitKeys([
        { ipHash: "ip-1", deviceHash: "device-1" },
        { ipHash: "ip-1", deviceHash: "device-2" },
      ]).sort(),
    ).toEqual(["device:device-1", "device:device-2", "ip:ip-1"]);
  });

  it("returns no bucket keys when no related sources exist", () => {
    expect(getRateLimitKeys([])).toEqual([]);
  });
});
