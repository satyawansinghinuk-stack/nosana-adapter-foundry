/**
 * Builds (but never executes) the exact `nosana` CLI invocations a live Gate 1 run
 * would use. Nothing in this module imports node:child_process or performs any
 * network/wallet/filesystem I/O beyond returning strings - see
 * test/dry-run.test.ts's "does not import any process-execution module" guard.
 *
 * Every fact cited in the comments below was read directly from the installed
 * @nosana/cli 1.0.133 source under node_modules/@nosana/cli/dist/src - exact
 * paths and line numbers are given so they can be re-checked against a newer
 * CLI version before this is ever wired to a real submitter.
 */

export type NosanaNetwork = "mainnet" | "devnet";

export interface Gate1PostParams {
  jobDefinitionPath: string;
  market: string;
  walletPath: string;
  network?: NosanaNetwork;
  timeoutMinutes?: number;
  /** market.jobPrice, in the SDK's raw (pre /1e6) units. */
  marketJobPriceMicroUnits: number;
  /** market.jobTimeout, in seconds. */
  marketJobTimeoutSeconds: number;
}

export interface Gate1CommandPlan {
  argv: string[];
  /** VERIFIED_FROM_FILES formula: dist/src/cli/job/post/action.js:162. */
  costCeilingNos: number;
  warnings: string[];
}

/**
 * The `post` half of a live run: submit the job definition and wait for a
 * terminal state. Deliberately never adds -o/--output or --download:
 *
 *  - `-o/--output` throws `new Error('artifact support coming soon!')` before doing
 *    anything else, in the installed CLI (dist/src/cli/job/post/action.js:72-73).
 *    Everything after that line (volume creation, the nosana-node-helper
 *    artifact-uploader op) is unreachable dead code in 1.0.133.
 *  - `--download` is declared with `.conflicts('file')` on the `post` command
 *    (dist/src/cli/job/post/command.js:27), so it cannot be combined with our
 *    custom `-f/--file` job definition in a single `post` invocation at all -
 *    passing both would be rejected by commander before anything ran.
 */
export function buildGate1PostCommand(params: Gate1PostParams): Gate1CommandPlan {
  const argv = ["nosana", "job", "post", "--file", params.jobDefinitionPath, "--market", params.market, "--wait"];
  if (params.network) argv.push("--network", params.network);
  if (params.walletPath) argv.push("--wallet", params.walletPath);
  if (params.timeoutMinutes !== undefined) argv.push("--timeout", String(params.timeoutMinutes));

  const costCeilingNos = (params.marketJobPriceMicroUnits / 1e6) * params.marketJobTimeoutSeconds;

  return {
    argv,
    costCeilingNos,
    warnings: [
      "No artifact download is requested by this command. --output is unimplemented " +
        "(@nosana/cli 1.0.133 throws 'artifact support coming soon!'), and --download " +
        "conflicts with --file so it cannot be added here.",
      "Retrieval, if attempted at all, requires a separate `nosana job get <jobId>` call " +
        "(see buildGate1GetCommand) - and its own artifact-detection logic is unconfirmed " +
        "to fire for this job definition (see that function's warnings).",
    ],
  };
}

export interface Gate1GetParams {
  jobId: string;
  downloadPath?: string;
  network?: NosanaNetwork;
}

/**
 * The `get` half: fetch job state and, optionally, attempt artifact download.
 * `--download` is valid here (no `.conflicts('file')` on the `get` command -
 * dist/src/cli/job/get/command.js has no such conflict), but whether it does
 * anything is a separate question from whether it is syntactically allowed:
 * the CLI only auto-detects a downloadable artifact when the job definition's
 * *last op's id starts with "artifact-"* (dist/src/cli/job/get/action.js:170-188),
 * and even then it expects that op's own container to have pinned the artifact to
 * IPFS itself and printed the resulting hash in a specific log position. Our
 * current job definition's only op is id "gate1-artifact-roundtrip", which does
 * not match that convention, so --download here is expected to silently find
 * nothing to fetch - this is a real gap, not a theoretical one, and is recorded
 * as a STOP-relevant blocker in docs/nosana-cli-findings.md.
 */
export function buildGate1GetCommand(params: Gate1GetParams): Gate1CommandPlan {
  const argv = ["nosana", "job", "get", params.jobId];
  if (params.downloadPath) argv.push("--download", params.downloadPath);
  if (params.network) argv.push("--network", params.network);

  return {
    argv,
    costCeilingNos: 0,
    warnings: [
      "--download only does anything when the job definition's last op id starts with " +
        "'artifact-' (dist/src/cli/job/get/action.js:170-171). " +
        "src/nosana/job-definitions/gate1-artifact-roundtrip.job.json does not use that " +
        "convention, so this command is not confirmed to retrieve anything.",
    ],
  };
}
