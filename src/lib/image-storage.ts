// Persists uploaded product/avatar images to Vercel Blob storage in production,
// with a local filesystem fallback for development when no Blob token is set.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { put } from "@vercel/blob";

// Strips the original file name down to a safe, unique slug so user-supplied
// input never reaches the filesystem or storage path unescaped.
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
    // This is unrelated to the Postgres/Prisma database - it's the separate
    // file storage needed for uploaded image binaries.
    throw new Error(
      "Bild-Upload ist nicht konfiguriert: BLOB_READ_WRITE_TOKEN fehlt. Das ist ein separater Datei-Speicher (Vercel Blob), nicht die Datenbank. Bitte in Vercel unter Storage ein Blob-Store verbinden.",
    );
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, normalizedName), data);
  return `/uploads/${normalizedName}`;
}
