// Client-side end-to-end encryption helpers (AES-GCM).
// The server never sees plaintext or the passphrase.

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, orgId: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  // Salt is the org id — stable per-org, so members sharing the passphrase derive the same key.
  const salt = enc.encode(`onion::${orgId}`);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 150_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptMessage(
  plaintext: string,
  passphrase: string,
  orgId: string,
): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(passphrase, orgId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ptBytes = enc.encode(plaintext);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    ptBytes as BufferSource,
  );
  const ivBuf = new ArrayBuffer(iv.byteLength);
  new Uint8Array(ivBuf).set(iv);
  return { ciphertext: toB64(ct), iv: toB64(ivBuf) };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  passphrase: string,
  orgId: string,
): Promise<string> {
  try {
    const key = await deriveKey(passphrase, orgId);
    const ivBytes = fromB64(iv);
    const ctBytes = fromB64(ciphertext);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBytes as BufferSource },
      key,
      ctBytes as BufferSource,
    );
    return dec.decode(pt);
  } catch {
    return "🔒 [unable to decrypt — wrong key]";
  }
}

const KEY_PREFIX = "onion::orgkey::";
export function saveOrgKey(orgId: string, passphrase: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(KEY_PREFIX + orgId, passphrase);
}
export function loadOrgKey(orgId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY_PREFIX + orgId);
}
export function clearOrgKey(orgId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY_PREFIX + orgId);
}
