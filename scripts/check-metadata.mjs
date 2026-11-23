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
  if (!match) {
    throw new Error(`Cargo.toml is missing \`${key}\``);
  }
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

const legacy = pkg["tree-sitter"]?.[0];
const grammar = config.grammars?.[0];
if (!legacy) {
  errors.push('package.json is missing the "tree-sitter" metadata block');
} else if (!grammar) {
  errors.push("tree-sitter.json is missing grammar metadata");
} else {
  for (const field of ["scope", "file-types", "highlights", "injections", "injection-regex"]) {
    if (JSON.stringify(legacy[field]) !== JSON.stringify(grammar[field])) {
      errors.push(`${field} differs between package.json and tree-sitter.json`);
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) process.stderr.write(`  - ${error}\n`);
  process.exit(1);
}

console.log("Grammar metadata is in sync.");
