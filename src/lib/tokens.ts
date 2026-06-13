import { randomBytes } from "crypto";

// URL-safe random token for registration invite links.
export function newInviteToken() {
  return randomBytes(24).toString("base64url");
}
