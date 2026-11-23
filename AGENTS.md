# AGENTS.md

Guidance for agents working on the Elvish grammar for tree-sitter.

## Overview

This repository is a **tree-sitter grammar**, not a general application:

- `grammar.js` is the source of truth for the language definition.
- `tree-sitter.json` describes the grammar's scope, file types, and queries for newer tree-sitter tooling; `package.json` carries the equivalent metadata for older consumers.
- `src/parser.c`, `src/grammar.json`, and `src/node-types.json` are **generated** from `grammar.js` and are committed to the repo.
- `queries/` contains editor-facing syntax highlighting and injection queries that reference node names from the grammar.
- `bindings/node/` and `bindings/rust/` are thin wrappers that expose the generated C parser to Node and Rust consumers.
- `test/corpus/` contains the tree-sitter test corpus and is the primary behavioral test suite.

Never hand-edit `src/parser.c`, `src/grammar.json`, or `src/node-types.json`; edit `grammar.js` and regenerate.

## Commands

Use the pinned dev dependency (or a globally installed tree-sitter CLI of the same major version):

```sh
npm install          # installs tree-sitter-cli ^0.26.9
npm test             # runs `tree-sitter test`
npm run check:metadata  # verifies version, license, repository, and grammar metadata stay in sync
npx tree-sitter generate --abi 14   # regenerate src/parser.c, src/grammar.json, src/node-types.json
npx tree-sitter parse path/to/file.elv   # inspect an actual parse tree
cargo test           # builds the Rust binding and runs its load/doc tests
```

Notes:

- `tree-sitter test` does **not** regenerate the parser. Run `tree-sitter generate --abi 14` after any `grammar.js` change or tests will exercise stale output.
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
2. Run `tree-sitter generate --abi 14`.
3. Run `tree-sitter test` and fix either grammar or expectation.

Hidden rules (names starting with `_`) do not appear in expected trees; look for their aliases instead (for example `_statements` appears as `chunk`).

## Grammar architecture and conventions

Top level:

- `source_file` allows leading separators and then optional `_statements`, so empty input parses.
- `extras` is whitespace, comments, and the line continuation `^` followed by a newline, so these are permitted almost anywhere. The continuation is treated as inline whitespace and does not terminate a statement.
- `word: $ => $.identifier` tells tree-sitter that `identifier` drives keyword extraction and error recovery.
- `inline` lists `_statement`, `_expression`, `_literal`, `_string_like`, `_terminator`, and `_lhs_var`, which collapse these wrapper nodes out of the tree.
- `_terminator` is `";"` or `"\n"`; statements are separated this way.
- `_statements` requires at least one statement and allows trailing separators. Empty chunks are handled by the `chunk($)` helper, which allows leading separators and an optional `_statements` aliased to `chunk`.

Statements (`_statement`) are: `command`, `if` (with `elif`/`else`), `while`, `for`, `try` (with `catch`/`else`/`finally`), `import`, `function_definition`, `variable_declaration`, `variable_assignment`, `temporary_assignment`, `variable_deletion`, and `pipeline`. A bare lambda parses as a `command` whose head is a lambda. Order matters for ambiguity resolution.

Expressions are literals, `variable`, `output_capture`, `exception_capture`, `braced_list`, `indexing`, `lambda`, and `wildcard`.

Conventions used throughout:

- Use `field(...)` for semantically important children: `head`/`argument` on commands, `condition`, `var`/`container`, `exception`, `parameter`, `key`/`value`, `lhs`/`rhs`, `indices`, and `file`.
- Use `alias(...)` to give externally meaningful names to inline constructs, e.g. `_statements` → `chunk`, `repeat1(...)` → `lhs`/`rhs`/`indices`, and `bareword` → `file` in redirections.
- Use `token.immediate(...)` when a following `[` must not be preceded by whitespace (indexing and wildcard modifiers).
- `identifier` allows letters/numbers, `_ : ~ -`, and any non-ASCII character, matching Elvish's rule that any printable non-ASCII rune is allowed. Elvish namespaces and function markers like `edit:location` and `nop~` are single identifiers.
- `bareword` is the separate token for unquoted arguments (`/usr/local/bin`, `a.txt`, `7of9`) and also allows non-ASCII characters. `cmd_bareword` additionally allows `<`, `>`, `*`, and `^` in command position, matching Elvish's `CmdExpr` context.
- Keywords (`if`, `else`, `var`, `fn`, ...) are literal strings in the grammar, not identifier aliases.

Feature-specific gotchas:

- **Strings** are single tokens: single-quoted strings escape a quote by doubling it (`''`), double-quoted strings use backslash escapes. There is no interpolation node; `$name` inside a double-quoted string stays part of the `string` token. Adjacent string/variable/bareword primaries form a `compound` expression.
- **Lists vs maps** both start with `[`. A positional list is `list`; a map starts with `&` and may be empty (`[&]`) or contain pairs whose value is optional (`[&a]`, `[&a=]`). Do not make plain `[]` parse as a map.
- **Lambdas vs braced lists**: `lambda` is `{` triggered by a `|param|` list, whitespace, or `;`, followed by an optional `chunk`, then `}`. This lets `{ nop }`, `{ |a| nop}`, `{|a| nop}`, and `{|| nop}` parse. Bare `{a b}` in expression position is `braced_list`. Because whitespace immediately after `{` starts a lambda, `{ a , b }` is a lambda while `{a , b}` is a braced list.
- **Empty braced elements**: segments separated by commas are split further on whitespace, and empty segments become `empty_element` nodes (`{a,,b}`, `{,a}`, `{a,}`, `{,}`, and even `{}` all contain `empty_element` nodes). Zero-width elements require the external scanner.
- **Redirection** wraps the `port>` form in a `token(...)` before aliasing to `io_port`. The inline comment in `grammar.js` explains this is required; aliasing a non-token breaks parsing. `io_port` is also used for `>&2`-style targets.
- **Indexing** applies to `variable`, `string`, `bareword`, `list`, `map`, captures, `braced_list`, and `lambda`, and requires immediate `[`. `head_indexing` handles `command[0]` command heads. Assignment indices (`set list[1] = ...`) are a separate `indices` alias on `lhs`.
- **Comments**: the only comment form is `#` to end of line. The `injections.scm` query is a stub that captures comments.
- **Multiple `elif`** is supported via `repeat($.elif)`; keep this when editing `if`.
- **Lambda default values**: `parameter_option` requires a value after `=`, and a separate hidden rule `_parameter_option_empty` accepts the empty default `&opt=`. Because Elvish reads the next expression after `&opt=` as the option's value (whitespace allowed, as in `&opt= x`), an empty default may only be followed by more options or a rest parameter; `parameter_list` enforces this with a small inline state machine (see the comment there).
- **Option and map keys** use `option_key`, which supports concatenated primaries and indices (`&Ctrl-'['`, `&q[0]`, `&Alt-,`). The parts are lexed with `token.immediate`, so whitespace still separates keys from values.
- **Compound concatenation**: adjacent primaries in general expression positions parse as a `compound` node (`$a'b'`, `$dir'/'$name`, `$fname" is a Go file"`). Parts after the first are lexed with `token.immediate(...)` so whitespace still separates arguments. `option_key` continues to model the same adjacency rule for option and map keys.

## Generated parser and version pinning

- `src/parser.c` is generated with `--abi 14` (LANGUAGE_VERSION 14). `Cargo.toml` uses `tree-sitter = "0.26"` together with `tree-sitter-language = "0.1"`, and `package.json` pins `tree-sitter-cli` to `^0.26.9`.
- The CLI's generated `src/tree_sitter/parser.h` (plus `alloc.h`/`array.h`) must stay in sync with the runtime used by the bindings. Regenerating with a different CLI can change the struct layout, so update `Cargo.toml`, `package.json`, the generated files, and `cargo test` together. Use `--abi 14` for compatibility with editor runtimes that have not adopted ABI 15.
- `src/scanner.c` is the external scanner. It emits two zero-width tokens that both appear as `empty_element`: one for an empty first segment (no leading whitespace allowed, so `{ }` stays a lambda) and one for an empty segment after a comma (which skips extras). It is compiled by `bindings/rust/build.rs` and listed in `binding.gyp`.

## Queries

`queries/highlights.scm` maps grammar nodes to Neovim-style capture names (`@function`, `@keyword`, `@variable`, `@punctuation.*`, etc.) using `#any-of?`, `#eq?`, and `#match?` predicates. When renaming or restructuring nodes in `grammar.js`, update the queries in the same change or highlighting silently stops matching.

`queries/injections.scm` currently only captures comments. The Rust binding's query constants are commented out in `bindings/rust/lib.rs`; uncomment/include them if a consumer needs embedded query text.

## Style and licensing

- Source files carry `SPDX-License-Identifier: 0BSD` headers. Keep the header when creating source or query files.
- Commit messages in this repository use conventional prefixes such as `fix(strings): ...` and `fix: ...`.
- Match the existing JavaScript style in `grammar.js`: two-space indentation, section banner comments, and short inline comments only where the grammar is non-obvious.
