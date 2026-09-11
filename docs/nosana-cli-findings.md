# @nosana/cli 1.0.133 source investigation (read-only)

All paths below are relative to the installed package at
`node_modules/@nosana/cli/dist/src/` in this repository. Every claim here is
VERIFIED_FROM_FILES against that exact installed version (1.0.133) unless marked
otherwise. Nothing here has been confirmed against a live job.

## `--output` is not implemented

`cli/job/post/action.js:72-73`:

```js
if (options.output) {
    return formatter.throw(OUTPUT_EVENTS.OUTPUT_ARTIFACT_SUPPORT_INCOMING_ERROR, { error: new Error('artifact support coming soon!') });
    const volumeId = randomUUID() + '-volume';
    ... // unreachable
```

`-o/--output <path>` on `nosana job post` throws and returns immediately. The
volume-mount / `nosana-node-helper artifact-uploader` logic that follows (lines
74-113) is dead code in this version - it is never reached. There is currently
no working, CLI-native way to say "upload this folder from inside the container
as a downloadable artifact."

## `--download` cannot be combined with a custom `--file` job on `post`

`cli/job/post/command.js:27`:

```js
.addOption(new Option('--download [path]', 'download external artifacts to specified path  (implies --wait)').conflicts('file'))
```

`--download` is declared `.conflicts('file')`. Our job definition is submitted via
`-f/--file`, so `--download` cannot be present on the same `post` invocation at
all - commander rejects the combination before the command body runs.

`--url` also `.conflicts('file')` (same file, line 25) for the same reason.

## Safe command shape for a live submit

Given the above, the only verified-safe `post` invocation for our job is:

```
nosana job post --file <job.json> --market <market> --wait
```

with `--output`, `--download` and `--url` all omitted. Retrieval, if any, has to
be a separate command afterward. This is exactly what
`src/nosana/dry-run.ts#buildGate1PostCommand` builds.

## How the CLI decides an artifact is downloadable

`cli/job/get/action.js:170-188`:

```js
const artifactId = jsonFlow.ops[jsonFlow.ops.length - 1].id;
if (artifactId.startsWith('artifact-')) {
    if (result[artifactId]) {
        const steps = result[artifactId][1];
        if (Array.isArray(steps)) {
            const logs = steps[steps.length - 1].log;
            if (logs && logs[logs.length - 2]) {
                const ipfshash = logs[logs.length - 2][1].slice(-47, -1);
                if (options.download) {
                    await download(ipfshash, options.download, options, undefined, nosana);
                } else {
                    console.log(`... nosana download ${ipfshash}`);
                }
            }
        }
    }
}
```

Artifact auto-detection is keyed **only** on the job definition's *last op's
`id` string* starting with `"artifact-"`. It is not keyed on any container
filesystem path (`/nosana/outputs` or otherwise) - grep across
`node_modules/@nosana/cli/dist/src/` for `nosana/outputs` returns zero matches
(VERIFIED_BY_COMMAND, `grep -rn "nosana/outputs" node_modules/@nosana/cli/dist/src/`
on 2026-09-11). When the
last op's id does match, the CLI then expects *that op's own container* to have
already pinned the artifact to IPFS itself and printed the resulting CID in a
specific position in its own stdout log (`logs[logs.length - 2][1].slice(-47,
-1)`).

Our job definition's only op has `"id": "gate1-artifact-roundtrip"`, which does
not start with `"artifact-"`. **Given the current job definition, `nosana job get
<jobId> --download <path>` is not expected to detect or retrieve anything.**

The reference implementation of the op that *would* self-pin and print a CID is
the dead code at `cli/job/post/action.js:91-113`: it runs
`docker.io/nosana/nosana-node-helper:latest` with a Pinata JWT
(`PINATA_JWT: ['nosana/pinata-jwt']`) to do the pinning. Reproducing this
ourselves would mean depending on that same helper image and a Pinata
credential - a new secret-handling surface this project does not currently have
and that these instructions prohibit acquiring right now ("do not access
secrets").

**This is the single largest live-readiness blocker found in this review**: as
of @nosana/cli 1.0.133, there is no confirmed, working mechanism to get our
10 MiB artifact file back off a completed job through the CLI's own artifact
path. See `failureReason: "artifact_not_retrievable"` added to the evidence
schema for this exact condition.

## What `download`/`get` actually expect and return

`cli/job/download/action.js:11-22`:

```js
const data = await nosana.ipfs.retrieve(ipfshash, { responseType: 'arraybuffer' });
const output = zlib.gunzipSync(data);
...
readable.pipe(tar.extract({ cwd: outputFolder }));
```

Whatever is fetched from IPFS by this path is expected to be a **gzip-compressed
tar archive**, not a raw file. Any future artifact-retrieval implementation must
account for un-gzip+untar before hashing the extracted file - hashing the raw
downloaded bytes directly would not reproduce `artifactExpectedSha256`.

## Job state fields exposed by the SDK (via `job.*`)

All VERIFIED_FROM_FILES in `cli/job/get/action.js`:

| Field | Line(s) | Notes |
|---|---|---|
| `job.state` | 47, 50, 56, 81, 100 | String enum observed: `'RUNNING'`, `'COMPLETED'`, `'STOPPED'`. No distinct `'FAILED'` string was found; `services/jobs.js:12` resolves both completion and stop from a single numeric `jobAccount.state >= 2` condition, so "stopped" likely represents the non-success terminal outcome. |
| `job.price` | 44-45, 94-95 | Raw integer; display value is `price / 1e6`. |
| `job.market` | 41 | Used to build an explorer URL. |
| `job.node` | 62, 77, 82-84 | Host identity **is** exposed; also used to construct a per-node log/service URL (`https://${job.node}.${frp.serverAddr}`). |
| `job.timeStart`, `job.timeEnd` | 85-96 | Unix seconds. Duration = `timeEnd - timeStart`. |
| Cost | 94-96 | `((timeEnd - timeStart) * price) / 1e6`. |
| `job.ipfsJob` | 38, 64, 114 | CID of the posted job definition. |
| `job.ipfsResult` | 101-104 | CID of the job result; `nosana.ipfs.retrieve(job.ipfsResult)` returns `{ results, opStates }`. |

Cost-ceiling formula used when *posting* (before the job even exists), for
comparison: `cli/job/post/action.js:162`:
`nosNeeded = (parseInt(market.jobPrice) / 1e6) * market.jobTimeout`. This is the
formula `src/nosana/dry-run.ts` implements.

## Balance preconditions on `post`

`cli/job/post/action.js:156-170`: refuses to post if SOL balance < 0.005 SOL, or
if NOS balance < the computed `nosNeeded`. Both are VERIFIED_FROM_FILES
preconditions any future live submitter must handle rather than assume away.

## Confidential jobs

`inference/confidential.html` (docs, INFERENCE - fetched via search snippet, not
directly rendered): job definitions are transferred peer-to-peer and are
replaced with metadata-only stubs in the publicly posted version; the only way
to retrieve runtime logs is to keep the CLI connection open with `--wait`.
Gate 1 does not use confidential jobs - there is nothing confidential in it -
but this confirms the general rule this project already follows: nothing
sensitive may go in an ordinary (non-confidential) job definition, because
those are public by default.

## Not established by this review (UNKNOWN)

- Whether a newer `@nosana/cli` version implements `--output`.
- The exact structure/fields of `ipfsResult.opStates` (the "new result format"
  branched around at `get/action.js:106-112`) - not read in this pass.
- Whether `nosana.jobs.get`/`nosana.jobs.list` (the SDK calls underneath `post`
  and `get`) can be called directly without going through the CLI's `commander`
  action handlers, which would be needed for any future non-shelling-out
  submitter.
