import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteDocument } from "@/lib/documents";

// Absolute upload-age TTL (days). When set (>0), a document's bytes are deleted
// this many days after UPLOAD regardless of whether it was ever downloaded. This
// bounds storage so a backlog of un-reviewed vendors can't grow unbounded on a
// small disk. 0 / unset = disabled (only the post-download window applies).
function maxAgeDays() {
  const n = Number(process.env.DOC_MAX_AGE_DAYS);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// Delete files whose retention has elapsed — either (a) the post-first-download
// countdown, or (b) the absolute upload-age TTL (DOC_MAX_AGE_DAYS), whichever
// comes first. The metadata row is kept with purgedAt set, so we always know what
// the vendor originally provided — only the bytes go away, which is where the cost is.
export async function purgeExpiredDocuments(now = new Date()) {
  const ttl = maxAgeDays();
  const triggers: Prisma.VendorDocumentWhereInput[] = [{ purgeAfter: { lte: now } }];
  if (ttl > 0) {
    triggers.push({ uploadedAt: { lte: new Date(now.getTime() - ttl * 86400_000) } });
  }
  const due = await prisma.vendorDocument.findMany({
    where: { purgedAt: null, OR: triggers },
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
