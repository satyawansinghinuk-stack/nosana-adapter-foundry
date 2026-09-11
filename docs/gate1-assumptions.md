# Gate 1 assumptions and evidence boundaries

## Verified from installed source (read-only investigation, see docs/nosana-cli-findings.md)

- Job definitions use version `0.1`, type `container`, and `container/run` operations
  - VERIFIED_BY_COMMAND: our job definition passes `nosana job validate` on CLI 1.0.133.
- Operations accept image, command, GPU and environment fields (VERIFIED_FROM_FILES,
  `cli/job/post/action.js:50-58`).
- Ordinary job/result references are published through IPFS
  (`nosana.ipfs.pin`, `nosana.ipfs.retrieve` - VERIFIED_FROM_FILES,
  `cli/job/post/action.js:121`, `cli/job/get/action.js:64,101-104`).
- Job metadata exposes market, node, price, start time and end time
  (VERIFIED_FROM_FILES, `cli/job/get/action.js:38-96` - see docs/nosana-cli-findings.md
  for the full field table and the exact cost formula).
- **`-o/--output` is NOT implemented in CLI 1.0.133** - it throws `'artifact support
  coming soon!'` and returns immediately (VERIFIED_FROM_FILES,
  `cli/job/post/action.js:72-73`). This directly contradicts the "the CLI supports
  an output path" assumption this document previously carried; that assumption was
  wrong and is retracted.
- **`--download` cannot be combined with `--file`** on `job post`
  (`.conflicts('file')`, VERIFIED_FROM_FILES, `cli/job/post/command.js:27`).
- The job definition passes `nosana job validate` using CLI 1.0.133 (VERIFIED_BY_COMMAND).

## Not yet verified live

- The current market address and cost ceiling (the dry-run cost formula is verified
  from source; the actual numbers it should be fed are not).
- Whether a 10 MiB artifact completes and remains retrievable after the host finishes.
- Whether any mechanism other than the dead `nosana-node-helper artifact-uploader`
  path (`cli/job/post/action.js:91-113`, unreachable in 1.0.133) can get a file out
  of `/nosana/outputs` or any other in-container path at all.
- Whether a newer `@nosana/cli` release implements `--output`.

## Retracted / superseded assumptions

- ~~"The CLI supports an output path and artifact download."~~ Retracted:
  `--output` throws unconditionally in the installed version, and the only working
  auto-download path requires a job-definition convention
  (last op id starting with `"artifact-"`, plus that op self-pinning to IPFS) that
  our job definition does not use and that requires a third-party pinning
  credential (Pinata JWT) to reproduce. See docs/nosana-cli-findings.md.
- ~~"The downloaded archive structure and artifact filename [is unknown]"~~
  Partially resolved: when `download` *does* run, it treats the fetched IPFS
  content as a gzip+tar archive (`zlib.gunzipSync` then `tar.extract`,
  VERIFIED_FROM_FILES, `cli/job/download/action.js:11-22`). What remains unknown
  is whether our job would ever produce that shape given the blocker above.

## Non-claims

- A passing simulation is not a passing Nosana gate.
- Gate 1 does not test model training, GPU correctness, confidentiality, preemption recovery or checkpoint durability.
- The public deterministic seed is not a cryptographic secret.
- The current JSON hashing function is deterministic for JSON-compatible inputs used here, but is not claimed to implement RFC 8785.
- A live evidence JSON file remains self-asserted until its job and result references are independently fetched and verified. The evidence schema (`src/evidence/job-evidence.ts`, schema version 1.1.0) now enforces this structurally: `gatePassed: true` requires a populated, internally-consistent `independentJobState` record, not just a job ID and CID that merely look well-formed. Format validity is checked by `validateEvidence`; truthfulness of `independentJobState` is not something this module - or any static check - can guarantee, only whoever populates it actually calling the SDK can.
- Format-valid Solana addresses and IPFS CIDs used as test fixtures (e.g. the
  well-known System Program address and a well-known example CIDv0) are shape
  fixtures only, not claims that any Gate 1 run has touched them.
