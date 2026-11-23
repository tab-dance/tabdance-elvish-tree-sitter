#!/usr/bin/env node
// SPDX-License-Identifier: 0BSD

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function cargoString(manifest, key) {
  const match = manifest.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, "m"));
  if (!match) throw new Error(`Cargo.toml is missing \`${key}\``);
  return match[1];
}

function normalizeRepository(url) {
  return url
    .replace(/^git\+/, "")
    .replace(/^github:/, "https://github.com/")
    .replace(/\.git$/, "");
}

const pkg = JSON.parse(read("package.json"));
const config = JSON.parse(read("tree-sitter.json"));
const cargo = read("Cargo.toml");

const checks = [
  ["version", [pkg.version, cargoString(cargo, "version"), config.metadata.version]],
  ["license", [pkg.license, cargoString(cargo, "license"), config.metadata.license]],
  [
    "repository",
    [
      normalizeRepository(pkg.repository.url),
      normalizeRepository(cargoString(cargo, "repository")),
      normalizeRepository(config.metadata.links.repository),
    ],
  ],
];

const errors = [];
for (const [field, values] of checks) {
  if (new Set(values).size > 1) {
    errors.push(`${field} differs between files: ${values.join(", ")}`);
  }
}

const legacy = pkg["tree-sitter"] || [];
const grammars = config.grammars || [];
if (legacy.length !== grammars.length) {
  errors.push(`grammar count differs: package.json has ${legacy.length}, tree-sitter.json has ${grammars.length}`);
}

for (let i = 0; i < grammars.length; i++) {
  const g = grammars[i];
  const l = legacy[i];
  if (!l) {
    errors.push(`package.json missing grammar metadata for ${g.name}`);
    continue;
  }
  for (const field of ["scope", "file-types", "highlights", "injections", "injection-regex"]) {
    if (JSON.stringify(l[field]) !== JSON.stringify(g[field])) {
      errors.push(`${g.name}.${field} differs between package.json and tree-sitter.json`);
    }
  }
  if ((l.path || ".") !== (g.path || ".")) {
    errors.push(`${g.name}.path differs between package.json and tree-sitter.json`);
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`  - ${error}\n`);
  process.exit(1);
}

console.log("Grammar metadata is in sync.");
