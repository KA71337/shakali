export type DeviceInfo = {
  device: string;
  browser: string;
  os: string;
  model: string | null;
};

function cleanHint(value: string | null, maxLength = 100): string {
  return (value ?? "")
    .replace(/^"|"$/g, "")
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
  const brands = cleanHint(
    headers.get("sec-ch-ua-full-version-list") ?? headers.get("sec-ch-ua"),
    500,
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
      return `${label} ${version.split(".")[0]}`;
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
    return Number.isFinite(major) && major >= 13 ? "Windows 11" : "Windows 10";
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

  if (/Linux/i.test(platform) || /Linux/i.test(userAgent)) {
    return "Linux";
  }

  return platform || "Не определена";
}

function parseAndroidModel(userAgent: string): string | null {
  const buildModel = userAgent.match(/Android\s[^;)]*;(?:\s*[a-z]{2}(?:-[A-Z]{2})?;)?\s*([^;)]+?)\s+Build\//i)?.[1];
  const fallbackModel = userAgent.match(/Android\s[^;)]*;\s*([^;)]+?)(?:;\s*wv)?\)/i)?.[1];
  const candidate = (buildModel ?? fallbackModel ?? "")
    .replace(/^Build\//i, "")
    .replace(/;\s*wv$/i, "")
    .trim();

  if (!candidate || /^(Mobile|Tablet|wv)$/i.test(candidate)) {
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
    device = "Apple iPad";
  } else if (/iPhone|iPod/i.test(userAgent)) {
    device = "Apple iPhone";
  } else if (os.startsWith("Android")) {
    device = mobileHint === "?0" || /Tablet/i.test(userAgent) ? "Android-планшет" : "Android-смартфон";
  } else if (os.startsWith("Windows")) {
    device = "Windows PC";
  } else if (os.startsWith("macOS")) {
    device = "Mac";
  } else if (os === "Linux") {
    device = "Linux PC";
  }

  return {
    device,
    browser: parseBrowser(userAgent, headers),
    os,
    model,
  };
}
