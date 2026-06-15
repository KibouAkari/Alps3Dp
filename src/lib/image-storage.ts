import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";

function normalizeFileName(input: string) {
  const extension = path.extname(input || "").toLowerCase() || ".webp";
  const baseName = path.basename(input || "upload", extension);
  const safeBase = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${safeBase || "image"}-${crypto.randomUUID().slice(0, 8)}${extension}`;
}

export async function storeProductImage(fileName: string, data: Buffer) {
  const normalizedName = normalizeFileName(fileName);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`products/${normalizedName}`, data, {
      access: "public",
      addRandomSuffix: false,
      contentType: "image/webp",
    });

    return blob.url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("BLOB_READ_WRITE_TOKEN fehlt. Bitte Vercel Blob fuer Uploads konfigurieren.");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, normalizedName), data);
  return `/uploads/${normalizedName}`;
}
