import { describe, expect, it } from "vitest";

import { issueFormToken, verifyFormToken } from "@/lib/form-token";

describe("form token", () => {
  it("is signed, device-bound, age-limited, and bot-delayed", () => {
    const issuedAt = Date.UTC(2026, 7, 8, 20, 0, 0);
    const token = issueFormToken("11111111-1111-4111-8111-111111111111", issuedAt);

    expect(
      verifyFormToken(token, "11111111-1111-4111-8111-111111111111", issuedAt + 100),
    ).toEqual({ ok: false, reason: "too_fast" });
    expect(
      verifyFormToken(token, "11111111-1111-4111-8111-111111111111", issuedAt + 700),
    ).toEqual({ ok: true });
    expect(
      verifyFormToken(token, "22222222-2222-4222-8222-222222222222", issuedAt + 700),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      verifyFormToken(`${token}x`, "11111111-1111-4111-8111-111111111111", issuedAt + 700),
    ).toEqual({ ok: false, reason: "invalid" });
  });
});
