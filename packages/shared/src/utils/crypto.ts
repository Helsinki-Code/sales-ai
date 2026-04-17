import crypto from "node:crypto";

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function randomSecret(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function encryptText(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("INTERNAL_ENCRYPTION_KEY must be 64 hex chars (32 bytes).");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${ciphertext.toString("hex")}:${tag.toString("hex")}`;
}

export function decryptText(payload: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const [ivHex, dataHex, tagHex] = payload.split(":");
  if (!ivHex || !dataHex || !tagHex) throw new Error("Invalid encrypted payload format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}