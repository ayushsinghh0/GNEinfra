import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// A tiny storage abstraction so the rest of the app never cares where files
// live. Local disk in development; S3 (or any S3-compatible store, e.g. MinIO)
// in production. Selected by STORAGE_DRIVER. Switching is an env change only.

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

// ── Local disk driver (development) ─────────────────────────────────────────
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// Resolve a key under UPLOAD_ROOT, refusing any path-traversal escape.
function safeLocalPath(key: string) {
  const root = path.resolve(UPLOAD_ROOT);
  const abs = path.resolve(root, key);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error("Invalid storage key");
  }
  return abs;
}

const localStorage: Storage = {
  async put(key, body) {
    const abs = safeLocalPath(key);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, body);
  },
  async get(key) {
    return readFile(safeLocalPath(key));
  },
  async delete(key) {
    await unlink(safeLocalPath(key)).catch(() => {});
  },
};

// ── S3 driver (production) ──────────────────────────────────────────────────
let _s3: S3Client | null = null;
function s3Client() {
  if (_s3) return _s3;
  _s3 = new S3Client({
    region: process.env.AWS_REGION || "ap-south-1",
    // endpoint/forcePathStyle let this talk to MinIO locally; unset in real AWS.
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined, // fall back to the default AWS credential chain (IAM role)
  });
  return _s3;
}

function bucket() {
  const b = process.env.S3_BUCKET;
  if (!b) throw new Error("S3_BUCKET is not set");
  return b;
}

const s3Storage: Storage = {
  async put(key, body, contentType) {
    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  },
  async get(key) {
    const res = await s3Client().send(
      new GetObjectCommand({ Bucket: bucket(), Key: key })
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  },
  async delete(key) {
    await s3Client().send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: key })
    );
  },
};

export const storage: Storage =
  (process.env.STORAGE_DRIVER || "local") === "s3" ? s3Storage : localStorage;
