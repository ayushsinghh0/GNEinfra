import { prisma } from "@/lib/prisma";
import { deleteDocument } from "@/lib/documents";

// Delete files whose purge countdown (set on first download) has elapsed.
// The metadata row is kept with purgedAt set, so we always know what the vendor
// originally provided — only the bytes go away, which is where the cost is.
export async function purgeExpiredDocuments(now = new Date()) {
  const due = await prisma.vendorDocument.findMany({
    where: { purgeAfter: { lte: now }, purgedAt: null },
  });

  let purged = 0;
  let failed = 0;
  let freedBytes = 0;
  for (const doc of due) {
    try {
      await deleteDocument(doc.storageKey);
      await prisma.vendorDocument.update({
        where: { id: doc.id },
        data: { purgedAt: new Date() }, // actual deletion time, per document
      });
      purged++;
      freedBytes += doc.storedSize ?? 0;
    } catch (e) {
      // Leave it for the next run if storage delete fails; surface the error.
      failed++;
      console.error("[purge] failed to delete document", doc.id, e);
    }
  }
  return { scanned: due.length, purged, failed, freedBytes };
}
