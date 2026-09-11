import { copyFile, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { writeDeterministicArtifact } from "../generator/deterministic-artifact.ts";
import { canonicalJsonSha256, sha256File } from "../hashing/sha256.ts";
import { validateEvidence, type JobEvidence } from "../evidence/job-evidence.ts";
import { lintSecrets } from "../security/secret-lint.ts";

const GATE1_ARTIFACT_SIZE_BYTES = 10 * 1024 * 1024;
const GATE1_SEED = "nosana-gate1-public-v1";

// Only --simulate is a recognized mode today. Live execution is deliberately not
// implemented (see docs/gate1-assumptions.md and docs/nosana-cli-findings.md) -
// any other argument is rejected rather than silently ignored, so a future "--live"
// typo can never fall through into simulation mode unnoticed.
const recognizedArgs = new Set(["--simulate"]);
const args = process.argv.slice(2);
const unrecognized = args.filter((a) => !recognizedArgs.has(a));
if (unrecognized.length) throw new Error(`unrecognized argument(s): ${unrecognized.join(", ")}`);
if (!args.includes("--simulate")) throw new Error("live execution is not implemented; use --simulate");

async function main(): Promise<void> {
  const root = resolve(import.meta.dirname, "../..");
  const job = JSON.parse(await readFile(resolve(root, "src/nosana/job-definitions/gate1-artifact-roundtrip.job.json"), "utf8"));

  const secretFindings = lintSecrets(job);
  if (secretFindings.length) throw new Error(`public job definition failed secret lint: ${JSON.stringify(secretFindings)}`);

  const runDir = resolve(tmpdir(), `nosana-gate1-${randomUUID()}`);
  await mkdir(runDir, { recursive: true });
  const expectedPath = resolve(runDir, "expected.bin");
  const retrievedPath = resolve(runDir, "retrieved.bin");
  const started = new Date();
  try {
    const params = { seed: GATE1_SEED, sizeBytes: GATE1_ARTIFACT_SIZE_BYTES };
    await writeDeterministicArtifact(expectedPath, params);
    // Stands in for the download leg of a live round trip: a real run replaces this
    // copyFile with "fetch the result CID, gunzip+untar it" (see docs/nosana-cli-findings.md).
    await copyFile(expectedPath, retrievedPath);
    const [expectedHash, actualHash, actualStat] = await Promise.all([
      sha256File(expectedPath),
      sha256File(retrievedPath),
      stat(retrievedPath),
    ]);
    const completed = new Date();
    const hashMatch = expectedHash === actualHash && actualStat.size === params.sizeBytes;

    const evidence: JobEvidence = {
      schemaVersion: "1.1.0",
      gateId: "gate1-artifact-roundtrip",
      executionMode: "simulation",
      gatePassed: false,
      nosanaJobId: null,
      market: null,
      node: null,
      jobDefinitionSha256: canonicalJsonSha256(job),
      submittedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      wallClockSeconds: (completed.getTime() - started.getTime()) / 1000,
      costNos: null,
      costUsd: null,
      resultReference: null,
      artifactExpectedSha256: expectedHash,
      artifactActualSha256: actualHash,
      artifactExpectedBytes: params.sizeBytes,
      artifactActualBytes: actualStat.size,
      hashMatch,
      failureReason: "simulation_is_not_live_evidence",
      verifiedAt: null,
      verifierVersion: null,
      independentJobState: null,
    };
    validateEvidence(evidence);

    await mkdir(resolve(root, "evidence"), { recursive: true });
    const evidencePath = resolve(root, `evidence/gate1-simulation-${started.toISOString().replaceAll(":", "-")}.json`);
    await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify({ evidencePath, hashMatch: evidence.hashMatch, gatePassed: evidence.gatePassed, executionMode: evidence.executionMode }, null, 2));
  } finally {
    await rm(runDir, { recursive: true, force: true });
  }
}

await main();
