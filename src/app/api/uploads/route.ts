import { NextResponse } from "next/server";

import { storeProductImage } from "@/lib/image-storage";
import { AUTH_COOKIE_NAME, getSessionUserFromToken } from "@/lib/session";

export const runtime = "nodejs";

function getCookieToken(request: Request) {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.split("=")[1];
}

export async function POST(request: Request) {
  const user = await getSessionUserFromToken(getCookieToken(request));
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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: `Datei '${file.name}' ist kein Bild.` }, { status: 400 });
    }

    const maxBytes = scope === "avatar" ? 3 * 1024 * 1024 : 8 * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json({ error: `Datei '${file.name}' ist zu groß (max. ${scope === "avatar" ? "3" : "8"}MB).` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await storeProductImage(file.name, buffer);
    uploadedUrls.push(url);
  }

  return NextResponse.json({ urls: uploadedUrls });
}
