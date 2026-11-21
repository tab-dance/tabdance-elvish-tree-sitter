# AGENTS.md

Guidance for agents working on the Elvish grammar for tree-sitter.

## Overview

This repository is a **tree-sitter grammar**, not a general application:

- `grammar.js` is the source of truth for the language definition.
- `src/parser.c`, `src/grammar.json`, and `src/node-types.json` are **generated** from `grammar.js` and are committed to the repo.
- `queries/` contains editor-facing syntax highlighting and injection queries that reference node names from the grammar.
- `bindings/node/` and `bindings/rust/` are thin wrappers that expose the generated C parser to Node and Rust consumers.
- `test/corpus/` contains the tree-sitter test corpus and is the primary behavioral test suite.

Never hand-edit `src/parser.c`, `src/grammar.json`, or `src/node-types.json`; edit `grammar.js` and regenerate.

## Commands

There is no globally installed tree-sitter CLI in this environment. Install the pinned dev dependency first:

```sh
npm install          # installs tree-sitter-cli ^0.20.6
npm test             # runs `tree-sitter test`
npx tree-sitter generate   # regenerate src/parser.c, src/grammar.json, src/node-types.json
npx tree-sitter parse path/to/file.elv   # inspect an actual parse tree
cargo test           # builds the Rust binding and runs its load/doc tests
```

Notes:

- `tree-sitter test` does **not** regenerate the parser. Run `tree-sitter generate` after any `grammar.js` change or tests will exercise stale output.
- `cargo test` only verifies that the Rust binding compiles and can load the grammar. It does **not** run the corpus tests.
- The Node binding is built from `binding.gyp` with `node-gyp` (there is no npm script for it); it depends on `nan`.
- `Cargo.lock` and `target/` are created by cargo and are ignored via `.gitignore`. Do not add them to commits.

## Test corpus

Tests live in `test/corpus/*.txt` grouped by feature (`expressions`, `literals`, `statements`). Each test is:

```
===
Test name
===

<input source>

---

(expected S-expression tree)
```

The expected tree must match exactly, including whitespace in the source input. When adding a grammar feature:

1. Add at least one corpus case.
2. Run `tree-sitter generate`.
3. Run `tree-sitter test` and fix either grammar or expectation.

Hidden rules (names starting with `_`) do not appear in expected trees; look for their aliases instead (for example `_statements` appears as `chunk`).

## Grammar architecture and conventions

Top level:

- `source_file` is `optional($._statements)`, so empty input parses.
- `extras` is whitespace plus `comment`, so comments are permitted almost anywhere.
- `word: $ => $.identifier` tells tree-sitter that `identifier` drives keyword extraction and error recovery.
- `inline` lists `_statement`, `_expression`, `_literal`, `_string_like`, and `_terminator`, which collapse these wrapper nodes out of the tree.
- `_terminator` is `";"` or `"\n"`; statements are separated this way.
- `_statements` uses `prec(1)` and requires at least one statement. It is always aliased to `chunk` inside braces and captures.

Statements (`_statement`) are: `command`, `if` (with `elif`/`else`), `while`, `for`, `try` (with `catch`/`else`/`finally`), `import`, `function_definition`, `variable_declaration`, `variable_assignment`, `temporary_assignment`, `variable_deletion`, `lambda`, and `pipeline`. Order matters for ambiguity resolution.

Expressions are literals, `variable`, `output_capture`, `exception_capture`, `braced_list`, `indexing`, `lambda`, and `wildcard`.

Conventions used throughout:

- Use `field(...)` for semantically important children: `head`/`argument` on commands, `condition`, `var`/`container`, `exception`, `parameter`, `key`/`value`, `lhs`/`rhs`, `indices`, and `file`.
- Use `alias(...)` to give externally meaningful names to inline constructs, e.g. `_statements` → `chunk`, `repeat1(...)` → `lhs`/`rhs`/`indices`, and `bareword` → `file` in redirections.
- Use `token.immediate(...)` when a following `[` must not be preceded by whitespace (indexing and wildcard modifiers).
- `identifier` is `/[\p{L}\p{N}_:~-]+/` (unicode letters/numbers plus `_ : ~ -`). Elvish namespaces and function markers like `edit:location` and `nop~` are single identifiers.
- `bareword` is the separate token for unquoted arguments (`/usr/local/bin`, `a.txt`, `7of9`).
- Keywords (`if`, `else`, `var`, `fn`, ...) are literal strings in the grammar, not identifier aliases.

Feature-specific gotchas:

- **Strings** are single tokens: single-quoted strings escape a quote by doubling it (`''`), double-quoted strings use backslash escapes. There is no interpolation node; `$name` inside a double-quoted string stays part of the `string` token.
- **Lists vs maps** both start with `[`. An `[]` or positional list is `list`; a map requires at least one `&key=value` pair. Do not make `map` allow zero pairs or empty lists become ambiguous/misparsed.
- **Lambdas vs braced lists**: `lambda` is `{` then either whitespace or a `|param|` list, then a `chunk`, then `}`. The `choice(/\s+/, $.parameter_list)` is deliberate so `{ nop }` and `{|a| nop}` both parse. Bare `{a b}` in expression position is `braced_list`.
- **Redirection** wraps the `port>` form in a `token(...)` before aliasing to `io_port`. The inline comment in `grammar.js` explains this is required; aliasing a non-token breaks parsing. `io_port` is also used for `>&2`-style targets.
- **Indexing** only applies to `variable`, `list`, `map`, and `output_capture`, and requires immediate `[`. Assignment indices (`set list[1] = ...`) are a separate `indices` alias on `lhs`.
- **Comments**: the only comment form is `#` to end of line. The `injections.scm` query is a stub that captures comments.
- **Multiple `elif`** is supported via `repeat($.elif)`; keep this when editing `if`.

## Generated parser and version pinning

- `src/parser.c` declares `LANGUAGE_VERSION 14`, which corresponds to tree-sitter 0.20. `Cargo.toml` pins `tree-sitter = "~0.20"`, and `package.json` pins `tree-sitter-cli` to `^0.20.6`.
- Regenerating with a newer tree-sitter CLI can emit a different ABI and a different `src/tree_sitter/parser.h`, which may break the Rust/Node bindings. If you upgrade the CLI, update `Cargo.toml`, `package.json`, the generated files, and re-run `cargo test` together.
- There is no external scanner (`scanner.c`/`scanner.cc`). The commented blocks in `bindings/rust/build.rs` and `binding.gyp` are boilerplate for adding one.

## Queries

`queries/highlights.scm` maps grammar nodes to Neovim-style capture names (`@function`, `@keyword`, `@variable`, `@punctuation.*`, etc.) using `#any-of?`, `#eq?`, and `#match?` predicates. When renaming or restructuring nodes in `grammar.js`, update the queries in the same change or highlighting silently stops matching.

`queries/injections.scm` currently only captures comments. The Rust binding's query constants are commented out in `bindings/rust/lib.rs`; uncomment/include them if a consumer needs embedded query text.

## Style and licensing

- Source files carry `SPDX-License-Identifier: 0BSD` headers. Keep the header when creating source or query files.
- Commit messages in this repository use conventional prefixes such as `fix(strings): ...` and `fix: ...`.
- Match the existing JavaScript style in `grammar.js`: two-space indentation, section banner comments, and short inline comments only where the grammar is non-obvious.
