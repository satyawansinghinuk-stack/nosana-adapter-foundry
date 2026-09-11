const sensitiveName = /(password|passwd|private.?key|secret|api.?key|access.?token|seed.?phrase|bearer|auth.?token)/i;

// Named, low-false-positive credential shapes. Kept conservative on purpose: no generic
// "high entropy string" heuristic, because our own SHA-256 hashes (64 hex chars) and IPFS
// CIDs are exactly the kind of thing an entropy heuristic would false-positive on.
const knownCredentialPatterns: Array<{ reason: string; pattern: RegExp }> = [
  { reason: "PEM private key block", pattern: /-----BEGIN [A-Z ]+PRIVATE KEY-----/ },
  { reason: "JWT (three-segment base64url token)", pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/ },
  { reason: "GitHub token", pattern: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,255}\b|\bgithub_pat_[A-Za-z0-9_]{22,255}\b/ },
  { reason: "Hugging Face token", pattern: /\bhf_[A-Za-z0-9]{20,64}\b/ },
  { reason: "AWS access key ID", pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { reason: "Bearer authorization header value", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/i },
  // Base58-encoded Solana secret key export (64-byte keypair -> 87-88 base58 chars).
  // Deliberately longer than a base58 Solana *public* key (32-44 chars) so job/market/node
  // addresses that legitimately appear in evidence never trigger this.
  { reason: "base58 Solana secret key material", pattern: /\b[1-9A-HJ-NP-Za-km-z]{87,88}\b/ },
];

export interface SecretFinding { path: string; reason: string }

/** The on-disk `id.json` Solana keypair format: a JSON array of exactly 64 bytes (0-255). */
function isSolanaKeypairArray(value: unknown[]): boolean {
  return value.length === 64 && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
}

export function lintSecrets(value: unknown, path = "$", keyName = ""): SecretFinding[] {
  const findings: SecretFinding[] = [];
  if (typeof value === "string") {
    if (sensitiveName.test(keyName)) findings.push({ path, reason: "sensitive field name in public definition" });
    for (const { reason, pattern } of knownCredentialPatterns) {
      if (pattern.test(value)) findings.push({ path, reason: `credential pattern in public definition: ${reason}` });
    }
    return findings;
  }
  if (Array.isArray(value)) {
    if (isSolanaKeypairArray(value)) {
      findings.push({ path, reason: "credential pattern in public definition: Solana keypair byte array" });
      return findings;
    }
    return value.flatMap((item, index) => lintSecrets(item, `${path}[${index}]`, keyName));
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) findings.push(...lintSecrets(item, `${path}.${key}`, key));
  }
  return findings;
}
