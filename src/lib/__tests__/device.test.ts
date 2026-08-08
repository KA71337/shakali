import { describe, expect, it } from "vitest";

import { detectDevice } from "@/lib/device";

describe("detectDevice", () => {
  it("uses Client Hints to report the concrete Android model", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (Linux; Android 16; Pixel 9 Pro Build/BP2A) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36",
      "sec-ch-ua": '"Google Chrome";v="151", "Chromium";v="151"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
      "sec-ch-ua-platform-version": '"16.0.0"',
      "sec-ch-ua-model": '"Pixel 9 Pro"',
    });

    expect(detectDevice(headers)).toEqual({
      device: "Android-смартфон",
      browser: "Chrome 151",
      os: "Android 16.0.0",
      model: "Pixel 9 Pro",
    });
  });

  it("falls back to the Android User-Agent model", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (Linux; Android 15; SM-S938B Build/AP3A.240905.015) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36",
    });

    expect(detectDevice(headers).model).toBe("SM-S938B");
  });

  it("distinguishes Windows 11 using platform version hints", () => {
    const headers = new Headers({
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36",
      "sec-ch-ua-platform": '"Windows"',
      "sec-ch-ua-platform-version": '"15.0.0"',
    });

    expect(detectDevice(headers).os).toBe("Windows 11");
  });
});
