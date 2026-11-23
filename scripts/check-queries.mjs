#!/usr/bin/env node
// SPDX-License-Identifier: 0BSD

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(args, options = {}) {
  const p = spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
  if (p.status !== 0) {
    process.stderr.write(p.stdout || "");
    process.stderr.write(p.stderr || "");
    process.exit(p.status ?? 1);
  }
  return p.stdout || "";
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tree-sitter-elvish-q-"));
try {
  const elvishLib = path.join(tmp, "elvish.so");
  run(["npx", "tree-sitter", "build", "elvish", "-o", elvishLib]);

  const fixture = path.join(root, "elvish/test/queries/highlights.elv");
  for (const q of [
    "elvish/queries/highlights.scm",
    "elvish/queries/injections.scm",
    "elvish/queries/textobjects.scm",
    "elvish/queries/indents.scm",
  ]) {
    run([
      "npx", "tree-sitter", "query", "-q", q, fixture,
      "--lib-path", elvishLib, "--lang-name", "elvish",
    ], { stdio: ["ignore", "pipe", "pipe"] });
  }

  const out = run([
    "npx", "tree-sitter", "query", "-c", "elvish/queries/highlights.scm", fixture,
    "--lib-path", elvishLib, "--lang-name", "elvish",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const required = [
    ["property", [1, 6], [1, 9], "`foo`"],
    ["property", [1, 16], [1, 17], "`k`"],
    ["operator", [2, 5], [2, 7], "`2>`"],
    ["operator", [2, 12], [2, 15], "`2>>`"],
    ["operator", [2, 20], [2, 23], "`2<>`"],
    ["number", [2, 29], [2, 31], "`&2`"],
    ["operator", [2, 37], [2, 43], "`stdin>`"],
    ["variable", [3, 6], [3, 11], "`'a b'`"],
    ["variable", [3, 13], [3, 18], '`"c d"`'],
  ];

  const caps = [];
  const re = /capture: \d+ - ([^,]+), start: \((\d+), (\d+)\), end: \((\d+), (\d+)\), text: (`.*`|"[^"]*")/g;
  for (const m of out.matchAll(re)) {
    caps.push([m[1], [Number(m[2]), Number(m[3])], [Number(m[4]), Number(m[5])], m[6]]);
  }
  const missing = required.filter((r) => !caps.some((c) => JSON.stringify(c) === JSON.stringify(r)));
  if (missing.length > 0) {
    process.stderr.write("missing expected highlight captures:\n");
    for (const m of missing) process.stderr.write(`  - ${JSON.stringify(m)}\n`);
    process.exit(1);
  }

  const transcriptLib = path.join(tmp, "elvish_transcript.so");
  run(["npx", "tree-sitter", "build", "elvish_transcript", "-o", transcriptLib]);
  const tFixture = path.join(root, "elvish_transcript/test/fixtures/sample.elvts");
  for (const q of ["elvish_transcript/queries/highlights.scm", "elvish_transcript/queries/injections.scm"]) {
    run([
      "npx", "tree-sitter", "query", "-q", q, tFixture,
      "--lib-path", transcriptLib, "--lang-name", "elvish_transcript",
    ], { stdio: ["ignore", "pipe", "pipe"] });
  }

  console.log("query checks passed");
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
