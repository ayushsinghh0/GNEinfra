export function fmtDate(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

// For date-ONLY values (e.g. date of incorporation) stored at UTC midnight —
// format in UTC so the day never shifts based on the server's timezone.
export function fmtDateOnly(d: Date | null | undefined) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
