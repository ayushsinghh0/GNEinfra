export function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}
