export type DeviceInfo = {
  device: string;
  browser: string;
  os: string;
  model: string | null;
  architecture: string | null;
};

function cleanHint(value: string | null, maxLength = 100): string {
  const sanitized = (value ?? "")
    .replace(/[\r\n\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
  return sanitized.startsWith('"') && sanitized.endsWith('"')
    ? sanitized.slice(1, -1).replaceAll('\\"', '"').trim()
    : sanitized;
}

function cleanListHint(value: string | null, maxLength = 1000): string {
  return (value ?? "")
    .replace(/[\r\n\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

function getBrandVersion(brands: string, brand: string): string | null {
  const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = brands.match(new RegExp(`"${escapedBrand}";v="([^"]+)"`, "i"));
  return match?.[1] ?? null;
}

function parseBrowser(userAgent: string, headers: Headers): string {
  const brands = cleanListHint(
    headers.get("sec-ch-ua-full-version-list") ?? headers.get("sec-ch-ua"),
    1000,
  );
  const brandCandidates: Array<[string, string]> = [
    ["Microsoft Edge", "Edge"],
    ["Google Chrome", "Chrome"],
    ["Chromium", "Chromium"],
    ["Opera", "Opera"],
  ];

  for (const [brand, label] of brandCandidates) {
    const version = getBrandVersion(brands, brand);
    if (version) {
      return `${label} ${version}`;
    }
  }

  const patterns: Array<[RegExp, string]> = [
    [/EdgA?\/([\d.]+)/, "Edge"],
    [/(?:OPR|Opera)\/([\d.]+)/, "Opera"],
    [/CriOS\/([\d.]+)/, "Chrome"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/FxiOS\/([\d.]+)/, "Firefox"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Version\/([\d.]+).*Safari\//, "Safari"],
  ];

  for (const [pattern, label] of patterns) {
    const match = userAgent.match(pattern);
    if (match?.[1]) {
      return `${label} ${match[1].split(".")[0]}`;
    }
  }

  return "Не определён";
}

function parseOs(userAgent: string, headers: Headers): string {
  const platform = cleanHint(headers.get("sec-ch-ua-platform"));
  const platformVersion = cleanHint(headers.get("sec-ch-ua-platform-version"));

  if (/Windows/i.test(platform) || /Windows NT/i.test(userAgent)) {
    const major = Number.parseInt(platformVersion.split(".")[0] ?? "", 10);
    if (Number.isFinite(major)) return major >= 13 ? "Windows 11" : "Windows 10";
    const ntVersion = userAgent.match(/Windows NT\s([\d.]+)/i)?.[1];
    return ntVersion === "10.0"
      ? "Windows 10 или 11"
      : `Windows${ntVersion ? ` NT ${ntVersion}` : ""}`;
  }

  const androidVersion = userAgent.match(/Android\s([\d.]+)/i)?.[1];
  if (/Android/i.test(platform) || androidVersion) {
    return `Android ${platformVersion || androidVersion || ""}`.trim();
  }

  const iosVersion = userAgent.match(/(?:CPU (?:iPhone )?OS|iPhone OS) ([\d_]+)/i)?.[1];
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return `iOS ${iosVersion?.replaceAll("_", ".") ?? ""}`.trim();
  }

  const macVersion = userAgent.match(/Mac OS X ([\d_]+)/i)?.[1];
  if (/macOS/i.test(platform) || /Macintosh/i.test(userAgent)) {
    return `macOS ${platformVersion || macVersion?.replaceAll("_", ".") || ""}`.trim();
  }

  if (/Chrome OS/i.test(platform) || /CrOS/i.test(userAgent)) return "ChromeOS";
  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) return "Linux";

  return platform || "Не определена";
}

function parseArchitecture(userAgent: string, headers: Headers): string | null {
  const hintedArchitecture = cleanHint(headers.get("sec-ch-ua-arch")).toLowerCase();
  const hintedBitness = cleanHint(headers.get("sec-ch-ua-bitness"));
  let architecture: string | null = null;

  if (/^(x86|x64|amd64)$/.test(hintedArchitecture)) architecture = "x86";
  else if (/^(arm|arm64|aarch64)$/.test(hintedArchitecture)) architecture = "ARM";
  else if (hintedArchitecture) architecture = hintedArchitecture;
  else if (/arm64|aarch64/i.test(userAgent)) architecture = "ARM";
  else if (/x86_64|x64|Win64|WOW64|amd64/i.test(userAgent)) architecture = "x86";

  if (!architecture) return null;
  const bitness = /^\d{2}$/.test(hintedBitness)
    ? hintedBitness
    : /arm64|aarch64|x86_64|x64|Win64/i.test(userAgent)
      ? "64"
      : "";
  return bitness ? `${architecture} (${bitness}-бит)` : architecture;
}

function parseAndroidModel(userAgent: string): string | null {
  const buildModel = userAgent.match(/Android\s[^;)]*;(?:\s*[a-z]{2}(?:-[A-Z]{2})?;)?\s*([^;)]+?)\s+Build\//i)?.[1];
  const fallbackModel = userAgent.match(/Android\s[^;)]*;\s*([^;)]+?)(?:;\s*wv)?\)/i)?.[1];
  const candidate = (buildModel ?? fallbackModel ?? "")
    .replace(/^Build\//i, "")
    .replace(/;\s*wv$/i, "")
    .trim();

  if (!candidate || /^(K|Mobile|Tablet|Android|wv)$/i.test(candidate)) {
    return null;
  }

  return cleanHint(candidate, 100) || null;
}

export function detectDevice(headers: Headers): DeviceInfo {
  const userAgent = cleanHint(headers.get("user-agent"), 1000);
  const hintedModel = cleanHint(headers.get("sec-ch-ua-model"));
  const os = parseOs(userAgent, headers);
  const model = hintedModel || (os.startsWith("Android") ? parseAndroidModel(userAgent) : null);
  const mobileHint = cleanHint(headers.get("sec-ch-ua-mobile"));

  let device = "Не определено";
  if (/iPad/i.test(userAgent)) {
    device = "Планшет Apple (iPad)";
  } else if (/iPhone|iPod/i.test(userAgent)) {
    device = "Смартфон Apple (iPhone)";
  } else if (os.startsWith("Android")) {
    if (/Android TV|SmartTV|GoogleTV|\bTV\b/i.test(userAgent)) {
      device = "Android TV";
    } else if (mobileHint === "?1" || /\bMobile\b/i.test(userAgent)) {
      device = "Android-смартфон";
    } else {
      device = "Android-планшет или другое устройство";
    }
  } else if (os.startsWith("Windows")) {
    device = "Компьютер Windows";
  } else if (os.startsWith("macOS")) {
    device = "Компьютер Mac";
  } else if (os === "ChromeOS") {
    device = "Chromebook";
  } else if (os === "Linux") {
    device = "Компьютер Linux";
  }

  return {
    device,
    browser: parseBrowser(userAgent, headers),
    os,
    model,
    architecture: parseArchitecture(userAgent, headers),
  };
}
