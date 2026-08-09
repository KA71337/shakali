export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = MAX_IMAGE_BYTES + 64 * 1024;
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_TYPES)[number];

export type ValidatedImage = {
  data: Buffer;
  mime: AllowedImageMime;
  size: number;
};

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  const prefix = new TextDecoder("ascii").decode(bytes.slice(0, 12));
  if (prefix.startsWith("GIF87a") || prefix.startsWith("GIF89a")) return "image/gif";
  if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function readLimitedFormData(request: Request): Promise<FormData> {
  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    throw new Error("BODY_TOO_LARGE");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new Error("INVALID_MULTIPART");
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      throw new Error("BODY_TOO_LARGE");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    body,
  }).formData();
}

export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (file.size === 0) throw new Error("IMAGE_EMPTY");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");

  const data = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectImageMime(data);
  if (!detectedMime || file.type.toLowerCase() !== detectedMime) {
    throw new Error("INVALID_IMAGE_TYPE");
  }

  return { data, mime: detectedMime, size: data.byteLength };
}
