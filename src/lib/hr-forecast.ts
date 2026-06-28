// Bespoke trend helpers (no ML/stat library). Plain numbers in/out.

// Least-squares linear regression over indices 0..n-1, projected forward `periods`
// steps. Results rounded + clamped at 0 (counts/money can't be negative).
export function linearForecast(values: number[], periods: number): number[] {
  const p = Math.max(0, Math.floor(periods));
  const n = values.length;
  if (p === 0) return [];
  if (n === 0) return Array(p).fill(0);
  if (n === 1) return Array(p).fill(Math.max(0, Math.round(values[0])));
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += values[i]; sxx += i * i; sxy += i * values[i]; }
  const denom = n * sxx - sx * sx;
  const b = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const a = (sy - b * sx) / n;
  const out: number[] = [];
  for (let k = 1; k <= p; k++) out.push(Math.max(0, Math.round(a + b * (n - 1 + k))));
  return out;
}

// Percent change curr vs prev; null when prev is 0 (no baseline).
export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

// Trailing moving average over a window.
export function movingAvg(values: number[], window: number): number[] {
  if (window <= 1) return values.slice();
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}
