import { NextResponse } from "next/server";

import { storeProductImage } from "@/lib/image-storage";
import { getSessionTokenFromRequest, getSessionUserFromToken } from "@/lib/session";

export const runtime = "nodejs";

function isAllowedImageBuffer(buffer: Buffer) {
  if (buffer.length < 12) {
    return false;
  }

  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a;
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;
  const isGif =
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61;

  return isJpeg || isPng || isWebp || isGif;
}

export async function POST(request: Request) {
  const user = await getSessionUserFromToken(getSessionTokenFromRequest(request));
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const formData = await request.formData();
  const scope = String(formData.get("scope") || "product");
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Keine Dateien erhalten." }, { status: 400 });
  }

  if (scope === "product" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  if (scope === "avatar" && files.length > 1) {
    return NextResponse.json({ error: "Für Avatar nur eine Datei erlaubt." }, { status: 400 });
  }

  if (scope === "product" && files.length > 12) {
    return NextResponse.json({ error: "Maximal 12 Bilder pro Upload." }, { status: 400 });
  }

  const uploadedUrls: string[] = [];

  for (const file of files) {
    const maxBytes = scope === "avatar" ? 3 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `Datei '${file.name}' ist zu groß (max. ${scope === "avatar" ? "3" : "8"}MB).` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!isAllowedImageBuffer(buffer)) {
      return NextResponse.json(
        { error: `Datei '${file.name}' ist kein unterstütztes Bildformat.` },
        { status: 400 },
      );
    }

    const url = await storeProductImage(file.name, buffer);
    uploadedUrls.push(url);
  }

  return NextResponse.json({ urls: uploadedUrls });
}
