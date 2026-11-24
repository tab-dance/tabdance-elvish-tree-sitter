#!/usr/bin/env node
// SPDX-License-Identifier: 0BSD

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const grammars = ["elvish", "elvish_transcript"];

function run(args, options = {}) {
  const p = spawnSync(args[0], args.slice(1), {
    cwd: root,
    stdio: "inherit",
    ...options,
  });
  if (p.status !== 0) process.exit(p.status ?? 1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tabdance-elvish-tree-sitter-"));
try {
  for (const grammar of grammars) {
    const lib = path.join(tmp, `${grammar}.so`);
    run(["npx", "tree-sitter", "build", grammar, "-o", lib]);
    run([
      "npx",
      "tree-sitter",
      "test",
      "--grammar-path",
      grammar,
      "--lib-path",
      lib,
      "--lang-name",
      grammar,
    ]);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
