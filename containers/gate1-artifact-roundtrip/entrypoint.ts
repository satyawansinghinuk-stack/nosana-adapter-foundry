import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { writeDeterministicArtifact } from "../../src/generator/deterministic-artifact.ts";
import { sha256File } from "../../src/hashing/sha256.ts";

const seed = process.env.ARTIFACT_PUBLIC_SEED ?? "";
const sizeBytes = Number(process.env.ARTIFACT_SIZE_BYTES);
const outputPath = process.env.ARTIFACT_OUTPUT_PATH ?? "/nosana/outputs/artifact.bin";
await mkdir(dirname(outputPath), { recursive: true });
await writeDeterministicArtifact(outputPath, { seed, sizeBytes });
console.log(JSON.stringify({ path: outputPath, sizeBytes, sha256: await sha256File(outputPath) }));
