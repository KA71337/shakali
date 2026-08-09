import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const image = await db.message.findFirst({
    where: { id, moderationStatus: "clean", imageData: { not: null } },
    select: { imageData: true, imageMime: true },
  });

  if (!image?.imageData || !image.imageMime) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  }

  return new Response(new Uint8Array(image.imageData), {
    headers: {
      "Content-Type": image.imageMime,
      "Content-Length": String(image.imageData.byteLength),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
