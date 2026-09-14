import { createHash, generateKeyPairSync, sign as cryptoSign, verify as cryptoVerify, createPublicKey, createPrivateKey } from "node:crypto";

// Package signing for the plugin registry (ruling R6).
//
// A client installs code it did not write, from a network it does not control, onto a
// machine holding the owner's business. So the signature is real ed25519 over a canonical
// serialisation, and verification happens before anything is unpacked — not after.
//
// The private key never leaves the control plane. Clients hold only the public key.

// JSON key order is not stable across producers, so hashing raw JSON.stringify output
// would make a signature depend on how the object happened to be built. Keys are sorted
// recursively first.
export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

export function checksum(payload) {
  return createHash("sha256").update(typeof payload === "string" ? payload : canonicalize(payload)).digest("hex");
}

export function generateSigningKeys() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  };
}

// What is signed is the identity of the package plus the hash of its contents, so a
// signature cannot be lifted from one version and replayed onto another.
function signedSubject({ pluginId, version, checksum: digest }) {
  return canonicalize({ pluginId, version, checksum: digest });
}

export function signPackage({ pluginId, version, files, privateKey }) {
  const digest = checksum(files);
  const signature = cryptoSign(null, Buffer.from(signedSubject({ pluginId, version, checksum: digest })), createPrivateKey(privateKey));
  return { pluginId, version, checksum: digest, signature: signature.toString("base64") };
}

// Returns a reason rather than a bare false: a client that refuses an install has to be
// able to tell the owner which check failed.
export function verifyPackage({ pluginId, version, files, checksum: digest, signature, publicKey }) {
  if (!signature) return { valid: false, reason: "This app is not signed." };
  if (!digest) return { valid: false, reason: "This app has no checksum." };

  const actual = checksum(files);
  if (actual !== digest) {
    return { valid: false, reason: "This app's contents do not match its checksum. It may have been altered." };
  }

  let valid = false;
  try {
    valid = cryptoVerify(
      null,
      Buffer.from(signedSubject({ pluginId, version, checksum: digest })),
      createPublicKey(publicKey),
      Buffer.from(signature, "base64"),
    );
  } catch {
    return { valid: false, reason: "This app's signature could not be read." };
  }

  if (!valid) return { valid: false, reason: "This app's signature is not from a trusted publisher." };
  return { valid: true, reason: null };
}
