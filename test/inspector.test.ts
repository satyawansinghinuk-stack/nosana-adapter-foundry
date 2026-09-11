import test from "node:test";
import assert from "node:assert/strict";
import { sha256, utf8ByteLength, buildEvidence } from "../website/app.js";

// These tests import website/app.js directly, the exact file the browser
// loads. app.js guards all DOM access behind `typeof document !== "undefined"`,
// so importing it under Node (no document global) only registers the pure
// functions below and does not touch the page.

test("sha256 matches the known digest of an empty string", async () => {
  assert.equal(await sha256(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

test("sha256 matches the known digest of a short ASCII string", async () => {
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("sha256 output is 64 lowercase hexadecimal characters", async () => {
  const digest = await sha256('{"workload":"artifact-roundtrip"}');
  assert.match(digest, /^[a-f0-9]{64}$/);
});

test("sha256 changes when a single byte of input changes", async () => {
  const a = await sha256("payload-a");
  const b = await sha256("payload-b");
  assert.notEqual(a, b);
});

test("utf8ByteLength counts UTF-8 bytes, not JS string length", () => {
  assert.equal(utf8ByteLength(""), 0);
  assert.equal(utf8ByteLength("abc"), 3);
  // "é" is one UTF-16 code unit but two UTF-8 bytes.
  assert.equal(utf8ByteLength("é"), 2);
  assert.equal("é".length, 1);
  // An emoji is one JS string element pair (surrogate pair, length 2) but four UTF-8 bytes.
  assert.equal(utf8ByteLength("🙂"), 4);
  assert.equal("🙂".length, 2);
});

test("buildEvidence never claims a Nosana job executed", () => {
  const evidence = buildEvidence({ digest: "a".repeat(64), byteLength: 12 });
  assert.equal(evidence.nosanaJobExecuted, false);
  assert.equal(evidence.executionMode, "local-browser");
});

test("buildEvidence labels an empty payload instead of presenting it as an artifact hash", () => {
  const evidence = buildEvidence({ digest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", byteLength: 0 });
  assert.ok(evidence.note && evidence.note.includes("empty payload"));
});

test("buildEvidence omits the empty-payload note for non-empty input", () => {
  const evidence = buildEvidence({ digest: "a".repeat(64), byteLength: 5 });
  assert.equal(evidence.note, undefined);
});
