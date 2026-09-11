import { createHash } from "node:crypto";
import { open, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export interface ArtifactParameters {
  seed: string;
  sizeBytes: number;
}

/**
 * Gate 1 never needs more than a few hundred MiB; this bounds "unsafe" sizeBytes
 * requests (e.g. an accidental Number.MAX_SAFE_INTEGER) from hanging the process
 * or filling the disk before validation has a chance to reject them.
 */
export const MAX_ARTIFACT_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GiB

export function validateArtifactParameters(params: ArtifactParameters): void {
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/i.test(params.seed)) throw new Error("seed must be a public identifier");
  if (!Number.isSafeInteger(params.sizeBytes) || params.sizeBytes < 1) throw new Error("sizeBytes must be a positive safe integer");
  if (params.sizeBytes > MAX_ARTIFACT_SIZE_BYTES) throw new Error(`sizeBytes must not exceed ${MAX_ARTIFACT_SIZE_BYTES} (unsafe artifact size)`);
}

/**
 * Writes a deterministic pseudorandom artifact: SHA-256(seed, counter) blocks
 * concatenated until sizeBytes is reached. Same seed + sizeBytes always produces
 * byte-identical output, on any host, with no key material involved.
 *
 * The destination file is opened with the exclusive "wx" flag *before* any bytes
 * are written. That open is the only thing allowed to fail without cleanup - if it
 * throws (e.g. EEXIST because a file already occupies `path`), nothing this call
 * touched needs to be removed, and a pre-existing, unrelated file at that path is
 * never deleted. Only once this call has created the file does a later failure
 * (including caller-triggered AbortSignal cancellation) result in that same file
 * being removed.
 */
export async function writeDeterministicArtifact(
  path: string,
  params: ArtifactParameters,
  options: { signal?: AbortSignal } = {},
): Promise<void> {
  validateArtifactParameters(params);
  async function* blocks(): AsyncGenerator<Buffer> {
    let written = 0;
    let counter = 0;
    while (written < params.sizeBytes) {
      const block = createHash("sha256").update(`nosana-gate1-v1\0${params.seed}\0${counter}`).digest();
      const chunk = block.subarray(0, Math.min(block.length, params.sizeBytes - written));
      written += chunk.length;
      counter += 1;
      yield chunk;
    }
  }

  const handle = await open(path, "wx");
  try {
    await pipeline(Readable.from(blocks()), handle.createWriteStream(), { signal: options.signal });
  } catch (error) {
    await rm(path, { force: true });
    throw error;
  } finally {
    await handle.close().catch(() => {});
  }
}
