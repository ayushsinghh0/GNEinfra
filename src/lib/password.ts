import { scrypt as _scrypt, randomBytes, timingSafeEqual, type ScryptOptions } from "crypto";
import { promisify } from "util";

// scrypt cost parameters. 128 * N * r bytes of memory (~16 MB here) — under
// Node's 32 MB default maxmem. Parameters are embedded in the stored string so
// they can be raised later without invalidating existing hashes.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N0 = Number(parts[1]);
  const r0 = Number(parts[2]);
  const p0 = Number(parts[3]);
  if (!N0 || !r0 || !p0) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const derived = await scrypt(plain.normalize("NFKC"), salt, expected.length, { N: N0, r: r0, p: p0 });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
