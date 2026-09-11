# Security policy

## Scope

This policy covers the code in this repository: the Gate 1 artifact-round-trip
prototype, its evidence schema, its secret linter, and its CI configuration.

It does not cover the Nosana network, the `@nosana/cli` package, or any of
their dependencies. Known dependency vulnerabilities in `@nosana/cli` are
tracked for awareness, not fixed here, in `docs/dependency-risk.md`. Report
issues in `@nosana/cli` itself to the Nosana project directly.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting for this repository
(the "Security" tab, then "Report a vulnerability") rather than opening a
public issue. This keeps a credential leak or an exploitable bug out of
public view until a fix is available.

If you find a secret committed to this repository (a wallet file, a private
key, an API token, or similar), report it the same way. Do not open a public
issue that quotes the secret.

## What this project does and does not protect against

- Nosana job definitions are public by default. The secret linter in
  `src/security/secret-lint.ts` exists to stop wallet material, API tokens,
  and similar credentials from being placed into a job definition before it
  is posted. It is a best-effort check, not a guarantee. Never rely on it
  as the only safeguard, review the job definition yourself before it is
  submitted.
- No wallet or credential is stored in this repository, in `.env.example`,
  or in any tracked evidence file. `.env.example` documents variable names
  only, with empty values.
- Simulation evidence files never contain a job address, a result reference,
  or any other live identifier. `src/evidence/job-evidence.ts` enforces this
  structurally and is covered by tests in `test/gate1.test.ts`.
- This project has not yet submitted a live Nosana job. Live submission is
  intentionally unimplemented, see `docs/nosana-cli-findings.md` for why.

## Supported versions

This is an early prototype with a single active line of development. Fixes
are made against the latest commit on `main`.
