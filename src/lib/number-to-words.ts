const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10), o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + " Hundred");
  if (r) parts.push(twoDigits(r));
  return parts.join(" ");
}

// Indian numbering (crore / lakh / thousand / hundred) without any currency
// framing — e.g. 123456 → "One Lakh Twenty Three Thousand Four Hundred Fifty
// Six". Used for NOPA "Qty (words)" prefills and the invoice amount line.
export function numberInWords(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "Zero";
  let n = Math.floor(value);
  if (n === 0) return "Zero";
  if (n > 9_999_999_999) return "(number too large)";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ");
}

// e.g. 123456 → "Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six Only".
export function amountInWords(rupees: number): string {
  if (!Number.isFinite(rupees) || rupees < 0) return "Rupees Zero Only";
  const n = Math.floor(rupees);
  if (n === 0) return "Rupees Zero Only";
  if (n > 9_999_999_999) return "Rupees (amount too large) Only";
  return "Rupees " + numberInWords(n) + " Only";
}
