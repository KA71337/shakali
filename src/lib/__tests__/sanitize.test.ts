import { describe, expect, it } from "vitest";

import { sanitizeMessage } from "@/lib/sanitize";

describe("sanitizeMessage", () => {
  it("removes executable HTML and keeps plain text", () => {
    const result = sanitizeMessage(
      '<img src=x onerror="alert(1)"><b>Привет</b><script>alert(1)</script>',
    );

    expect(result).toEqual({ ok: true, message: "Привет" });
  });

  it("counts Unicode symbols rather than UTF-16 code units", () => {
    const result = sanitizeMessage("🙂".repeat(1000));
    expect(result.ok).toBe(true);
  });

  it("rejects messages over 1000 symbols", () => {
    const result = sanitizeMessage("я".repeat(1001));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MESSAGE_TOO_LONG");
  });
});
