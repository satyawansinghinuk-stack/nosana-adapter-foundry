import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildGate1PostCommand, buildGate1GetCommand } from "../src/nosana/dry-run.ts";

test("post command never includes --output or --download", () => {
  const plan = buildGate1PostCommand({
    jobDefinitionPath: "src/nosana/job-definitions/gate1-artifact-roundtrip.job.json",
    market: "some-market-slug",
    walletPath: "/tmp/does-not-exist.json",
    marketJobPriceMicroUnits: 100_000,
    marketJobTimeoutSeconds: 600,
  });
  assert.ok(!plan.argv.includes("--output"));
  assert.ok(!plan.argv.includes("-o"));
  assert.ok(!plan.argv.includes("--download"));
  assert.ok(plan.argv.includes("--file"));
  assert.ok(plan.argv.includes("--wait"));
  assert.ok(plan.warnings.length > 0);
});

test("post command cost ceiling matches the installed CLI's own formula", () => {
  // VERIFIED_FROM_FILES: node_modules/@nosana/cli/dist/src/cli/job/post/action.js:162
  // nosNeeded = (parseInt(market.jobPrice) / 1e6) * market.jobTimeout
  const plan = buildGate1PostCommand({
    jobDefinitionPath: "job.json",
    market: "m",
    walletPath: "w",
    marketJobPriceMicroUnits: 250_000,
    marketJobTimeoutSeconds: 1200,
  });
  assert.equal(plan.costCeilingNos, (250_000 / 1e6) * 1200);
});

test("get command warns that --download is unconfirmed for this job definition", () => {
  const plan = buildGate1GetCommand({ jobId: "someJobAddress", downloadPath: "./out" });
  assert.ok(plan.argv.includes("--download"));
  assert.ok(plan.warnings.some((w) => w.includes("artifact-")));
});

test("dry-run modules perform no process execution and no network I/O", async () => {
  // Matches actual import/require statements only, so this test isn't tripped up
  // by these modules' own doc comments *talking about* what they must not do.
  const forbiddenImport = /\b(?:from|require\()\s*["'](?:node:)?(child_process|http|https)["']/;
  for (const file of ["src/nosana/dry-run.ts", "src/cli/gate1-live-dry-run.ts"]) {
    const source = await readFile(resolve(import.meta.dirname, "..", file), "utf8");
    assert.ok(!forbiddenImport.test(source), `${file} must not import a process-execution or network module`);
    assert.ok(!/\bfetch\s*\(/.test(source), `${file} must not call fetch()`);
    assert.ok(!/\bexec(a|Sync)?\s*\(/.test(source), `${file} must not call exec/execa`);
  }
});
