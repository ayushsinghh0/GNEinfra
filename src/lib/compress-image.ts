// Client-side image downscale + re-encode, BEFORE upload. This is the biggest
// lever for keeping bandwidth and cloud storage minimal: a 5 MB phone photo of
// a cheque becomes ~300–600 KB while staying perfectly readable.
//
// Only images are processed. PDFs and anything else pass through untouched —
// PDFs can't be reliably recompressed in the browser without destroying their
// text layer, so we leave them as-is (see README/notes).

const MAX_DIMENSION = 1800; // longest edge, px — plenty for document legibility
const JPEG_QUALITY = 0.8;

function isCompressibleImage(file: File) {
  return /^image\/(jpe?g|png|webp)$/i.test(file.type);
}

export async function compressImage(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // can't decode — upload original
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  // White backdrop so transparent PNGs don't turn black as JPEG.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
  );
  if (!blob || blob.size >= file.size) return file; // keep original if not smaller

  const newName = file.name.replace(/\.(png|webp|jpeg|jpg)$/i, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}

// Compress every file selected in the form's file inputs and replace them in the
// FormData, so the upload carries the shrunk versions.
export async function compressFormImages(form: HTMLFormElement, fd: FormData) {
  const inputs = form.querySelectorAll<HTMLInputElement>('input[type="file"]');
  for (const input of Array.from(inputs)) {
    if (!input.name) continue;
    // An untouched file input still contributes a zero-byte File entry to the
    // FormData — drop it so the server never receives empty document rows.
    if (!input.files || input.files.length === 0) {
      fd.delete(input.name);
      continue;
    }
    const compressed = await Promise.all(
      Array.from(input.files).map((f) => compressImage(f))
    );
    fd.delete(input.name);
    for (const f of compressed) fd.append(input.name, f, f.name);
  }
}
