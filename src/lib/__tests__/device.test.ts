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
      architecture: null,
    });
  });

  it("falls back to the Android User-Agent model", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (Linux; Android 15; SM-S938B Build/AP3A.240905.015) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36",
    });

    expect(detectDevice(headers).model).toBe("SM-S938B");
  });

  it("reports full browser and architecture Client Hints when available", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
      "sec-ch-ua-full-version-list":
        '"Not A(Brand";v="99.0.0.0", "Google Chrome";v="151.0.8123.42", "Chromium";v="151.0.8123.42"',
      "sec-ch-ua-platform": '"Windows"',
      "sec-ch-ua-platform-version": '"15.0.0"',
      "sec-ch-ua-arch": '"x86"',
      "sec-ch-ua-bitness": '"64"',
    });

    expect(detectDevice(headers)).toMatchObject({
      device: "Компьютер Windows",
      browser: "Chrome 151.0.8123.42",
      os: "Windows 11",
      model: null,
      architecture: "x86 (64-бит)",
    });
  });

  it("does not claim Windows 10 when a reduced UA cannot distinguish 10 from 11", () => {
    const headers = new Headers({
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36",
    });

    expect(detectDevice(headers).os).toBe("Windows 10 или 11");
  });

  it("does not invent an iPhone model when Safari does not reveal it", () => {
    const headers = new Headers({
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 Version/18.3 Mobile/15E148 Safari/604.1",
    });

    expect(detectDevice(headers)).toMatchObject({
      device: "Смартфон Apple (iPhone)",
      os: "iOS 18.3",
      model: null,
      architecture: null,
    });
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
