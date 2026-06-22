import { gzip, gunzip } from "zlib";
import { promisify } from "util";
import { randomBytes } from "crypto";
import { storage } from "@/lib/storage";

// Async (non-blocking) compression so a large upload never freezes the event loop.
const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// Upload constraints.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

// Cap decompression output so a crafted/corrupt .gz can't inflate unboundedly
// (zip-bomb DoS). Comfortably above the 10 MB upload limit.
const MAX_INFLATED_BYTES = 16 * 1024 * 1024;

// Verify the file's ACTUAL bytes (magic number) — never trust the client-supplied
// MIME type. Returns the canonical type, or null if it's not an allowed format.
// Prevents storing e.g. HTML/SVG/script disguised as image/png.
function sniffType(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return "application/pdf"; // %PDF
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  )
    return "image/webp";
  return null;
}

export type SavedDocument = {
  originalName: string;
  storageKey: string;
  mimeType: string;
  originalSize: number;
  storedSize: number;
  compressed: boolean;
};

// Compress + store a freshly uploaded file.
// We only KEEP the gzipped version if it is actually smaller — PDFs and JPEGs
// are already compressed, so gzip can inflate them. This guarantees we never
// pay to store more bytes than the original.
export async function saveDocument(
  vendorId: string,
  file: File
): Promise<SavedDocument> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File ${file.name} exceeds the 10 MB limit`);
  }
  if (!file.type || !ALLOWED.has(file.type)) {
    throw new Error(
      `File type "${file.type || "unknown"}" is not allowed (use PDF or image)`
    );
  }

  const original = Buffer.from(await file.arrayBuffer());

  // Content sniffing — the bytes must actually be a PDF/PNG/JPEG/WEBP, regardless
  // of the client-declared MIME. The detected type is what we store + serve.
  const detected = sniffType(original);
  if (!detected) {
    throw new Error(`File ${file.name} is not a valid PDF or image`);
  }

  const gz = await gzipAsync(original, { level: 9 });
  const compressed = gz.length < original.length;
  const body = compressed ? gz : original;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const rand = randomBytes(6).toString("hex");
  const key = `vendors/${vendorId}/${rand}-${safeName}${compressed ? ".gz" : ""}`;

  await storage.put(key, body, compressed ? "application/gzip" : detected);

  // Strip control characters / quotes from the display name so it can never break
  // a Content-Disposition header on download; keep it readable and bounded.
  const cleanName =
    file.name.replace(/[\r\n\t\0"\\]/g, " ").trim().slice(0, 200) || "document";

  return {
    originalName: cleanName,
    storageKey: key,
    mimeType: detected,
    originalSize: original.length,
    storedSize: body.length,
    compressed,
  };
}

// Fetch + decompress a stored document for download.
export async function readDocument(doc: {
  storageKey: string;
  compressed: boolean;
}): Promise<Buffer> {
  const raw = await storage.get(doc.storageKey);
  return doc.compressed
    ? await gunzipAsync(raw, { maxOutputLength: MAX_INFLATED_BYTES })
    : raw;
}

export async function deleteDocument(storageKey: string) {
  await storage.delete(storageKey);
}
