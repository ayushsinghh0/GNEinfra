import { gzipSync, gunzipSync } from "zlib";
import { randomBytes } from "crypto";
import { storage } from "@/lib/storage";

// Upload constraints.
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
const ALLOWED = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

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
  const gz = gzipSync(original, { level: 9 });
  const compressed = gz.length < original.length;
  const body = compressed ? gz : original;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const rand = randomBytes(6).toString("hex");
  const key = `vendors/${vendorId}/${rand}-${safeName}${compressed ? ".gz" : ""}`;

  await storage.put(
    key,
    body,
    compressed ? "application/gzip" : file.type || "application/octet-stream"
  );

  return {
    originalName: file.name,
    storageKey: key,
    mimeType: file.type || "application/octet-stream",
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
  return doc.compressed ? gunzipSync(raw) : raw;
}

export async function deleteDocument(storageKey: string) {
  await storage.delete(storageKey);
}
