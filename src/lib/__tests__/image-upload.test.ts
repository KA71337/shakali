import { describe, expect, it } from "vitest";

import { detectImageMime, validateImageFile } from "@/lib/image-upload";

describe("image upload validation", () => {
  it("detects allowed formats by magic bytes", () => {
    expect(detectImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectImageMime(new TextEncoder().encode("GIF89a"))).toBe("image/gif");
    expect(detectImageMime(new TextEncoder().encode("RIFF0000WEBP"))).toBe("image/webp");
  });

  it("rejects a spoofed MIME type", async () => {
    const file = new File(["not an image"], "fake.png", { type: "image/png" });
    await expect(validateImageFile(file)).rejects.toThrow("INVALID_IMAGE_TYPE");
  });

  it("rejects images larger than 2 MB", async () => {
    const file = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large.jpg", { type: "image/jpeg" });
    await expect(validateImageFile(file)).rejects.toThrow("IMAGE_TOO_LARGE");
  });
});
