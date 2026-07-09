// ---------- MFA (Time-based One-Time Password, RFC 6238) ----------
// Self-contained TOTP implementation compatible with Google Authenticator /
// Microsoft Authenticator / Authy (SHA-1, 6 digits, 30s step). No external
// library required — uses the browser's native Web Crypto API only.

const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    let chunk = bits.substr(i, 5);
    if (chunk.length < 5) chunk = chunk.padEnd(5, "0");
    out += B32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

function base32Decode(base32) {
  const clean = String(base32 || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const c of clean) {
    const val = B32_ALPHABET.indexOf(c);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.substr(i, 8), 2));
  return new Uint8Array(bytes);
}

function counterToBytes(counter) {
  const bytes = new Uint8Array(8);
  let temp = BigInt(Math.floor(counter));
  for (let i = 7; i >= 0; i--) {
    bytes[i] = Number(temp & 0xffn);
    temp >>= 8n;
  }
  return bytes;
}

async function hmacSha1(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, msgBytes);
  return new Uint8Array(sig);
}

/** Generates a fresh random base32 secret (default 20 bytes = 160-bit, the standard TOTP strength). */
export function generateSecretBase32(byteLen = 20) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

/** Computes the TOTP code for a given point in time. */
export async function totpAt(secretBase32, timeMs = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(timeMs / 1000 / step);
  const key = base32Decode(secretBase32);
  const msg = counterToBytes(counter);
  const hmac = await hmacSha1(key, msg);
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binCode % 10 ** digits;
  return String(otp).padStart(digits, "0");
}

/**
 * Verifies a 6-digit code against a secret, tolerating clock drift of
 * `window` steps (default ±1 step = ±30s) either side of "now".
 */
export async function verifyTotp(secretBase32, token, window = 1, step = 30, digits = 6) {
  if (!secretBase32 || !token) return false;
  const cleanToken = String(token).replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${digits}}$`).test(cleanToken)) return false;
  const now = Date.now();
  for (let errW = -window; errW <= window; errW++) {
    const candidate = await totpAt(secretBase32, now + errW * step * 1000, step, digits);
    if (candidate === cleanToken) return true;
  }
  return false;
}

/** Builds the otpauth:// URI used to render the enrollment QR code. */
export function buildOtpAuthUri(secretBase32, accountLabel, issuer = "JEANIC IT") {
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}
