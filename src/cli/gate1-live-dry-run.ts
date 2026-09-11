// Prints the exact `nosana` CLI command(s) a live Gate 1 run would use, and the
// computed NOS cost ceiling. Never executes anything - no child_process import
// exists anywhere in this file or in src/nosana/dry-run.ts (see
// test/dry-run.test.ts). Market price/timeout must be supplied as inputs, taken
// from an independently observed market record - this tool does not query the
// network itself.
import { buildGate1PostCommand, buildGate1GetCommand } from "../nosana/dry-run.ts";

const market = process.env.NOSANA_MARKET;
const walletPath = process.env.NOSANA_WALLET_PATH;
if (!market) throw new Error("NOSANA_MARKET is required to build a dry-run plan");
if (!walletPath) throw new Error("NOSANA_WALLET_PATH is required to build a dry-run plan");

const marketJobPriceMicroUnits = Number(process.env.GATE1_DRYRUN_MARKET_PRICE_MICRO_UNITS);
const marketJobTimeoutSeconds = Number(process.env.GATE1_DRYRUN_MARKET_TIMEOUT_SECONDS);
if (!Number.isFinite(marketJobPriceMicroUnits) || !Number.isFinite(marketJobTimeoutSeconds)) {
  throw new Error(
    "GATE1_DRYRUN_MARKET_PRICE_MICRO_UNITS and GATE1_DRYRUN_MARKET_TIMEOUT_SECONDS must be set " +
      "from a real, independently-observed market record (e.g. `nosana market get <market>`). " +
      "This tool computes the cost ceiling; it does not fetch market data itself.",
  );
}

const postPlan = buildGate1PostCommand({
  jobDefinitionPath: "src/nosana/job-definitions/gate1-artifact-roundtrip.job.json",
  market,
  walletPath,
  network: process.env.NOSANA_NETWORK === "devnet" ? "devnet" : "mainnet",
  timeoutMinutes: process.env.GATE1_TIMEOUT_MINUTES ? Number(process.env.GATE1_TIMEOUT_MINUTES) : undefined,
  marketJobPriceMicroUnits,
  marketJobTimeoutSeconds,
});

const maxCostNos = process.env.GATE1_MAX_COST_NOS ? Number(process.env.GATE1_MAX_COST_NOS) : undefined;
if (maxCostNos !== undefined && postPlan.costCeilingNos > maxCostNos) {
  throw new Error(`computed cost ceiling ${postPlan.costCeilingNos} NOS exceeds GATE1_MAX_COST_NOS ${maxCostNos}`);
}

const getPlan = buildGate1GetCommand({ jobId: "<jobId from post output>", downloadPath: "./gate1-retrieved" });

console.log(JSON.stringify(
  {
    executed: false,
    post: { command: postPlan.argv.join(" "), argv: postPlan.argv, costCeilingNos: postPlan.costCeilingNos, warnings: postPlan.warnings },
    get: { command: getPlan.argv.join(" "), argv: getPlan.argv, warnings: getPlan.warnings },
  },
  null,
  2,
));
