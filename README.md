tree-sitter-elvish
================

[Elvish](https://elv.sh) grammar for
[tree-sitter](https://github.com/tree-sitter/tree-sitter).

The grammar covers Elvish expressions, statements, pipelines, redirections,
lambdas, lists/maps, string literals, and compound concatenation, plus syntax
highlighting queries for editors.

#### References

* [Elvish Language Specification](https://elv.sh/ref/language.html)
* [tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/)

## Supported versions

| Component | Version |
| --- | --- |
| Grammar ABI | 14 (`LANGUAGE_VERSION 14`) |
| tree-sitter CLI | 0.26.x (pinned `^0.26.9` in `package.json`) |
| Rust `tree-sitter` crate | 0.26 |
| Rust `tree-sitter-language` crate | 0.1 |
| Node `tree-sitter` package | 0.25.x |
| Elvish | No version gate; tracks the current language specification |

The parser is generated with `--abi 14` so it can be loaded by editors and
runtimes that have not adopted ABI 15 yet. Regenerate the parser after
upgrading the CLI, since the CLI also emits the runtime headers in
`src/tree_sitter/` that the bindings compile against.

## Installation

### Neovim

This repository ships queries in the grammar layout (`queries/*.scm`), which is
what the tree-sitter CLI and Helix expect. Neovim looks for
`queries/<language>/<query>.scm` on `runtimepath`, so copy them into place:

```sh
mkdir -p ~/.config/nvim/queries/elvish
cp queries/*.scm ~/.config/nvim/queries/elvish/
```

Build the parser and register it:

```sh
npx tree-sitter build --output ~/.config/nvim/parser/elvish.so
```

```lua
vim.filetype.add({ extension = { elv = "elvish" } })

local ok, parsers = pcall(require, "nvim-treesitter.parsers")
if ok and parsers.get_parser_configs then
  parsers.get_parser_configs().elvish = {
    install_info = {
      url = "https://github.com/tab-dance/tree-sitter-elvish",
      files = { "src/parser.c" },
    },
    filetype = "elv",
  }
end
```

`:TSInstall elvish` from nvim-treesitter installs the upstream
`elves/tree-sitter-elvish` parser. Use the local registration above if you need
the fixes from this fork.

### Helix

Add the language to `languages.toml` and copy the queries into Helix's runtime:

```toml
[[language]]
name = "elvish"
scope = "source.elvish"
file-types = ["elv"]
comment-token = "#"
grammar = "elvish"
```

Put `highlights.scm` and `injections.scm` in `runtime/queries/elvish/` (under
the Helix config or installation directory) and build the grammar with
`hx --grammar build`.

### Node.js

```sh
npm install tree-sitter-elvish
```

```js
const Parser = require("tree-sitter");
const Elvish = require("tree-sitter-elvish");

const parser = new Parser();
parser.setLanguage(Elvish);

const tree = parser.parse("echo hello\n");
console.log(tree.rootNode.toString());
```

Requires the `tree-sitter` native package (`^0.25.0`) alongside this grammar.

### Rust

```toml
[dependencies]
tree-sitter = "0.26"
tree-sitter-elvish = { git = "https://github.com/tab-dance/tree-sitter-elvish" }
```

```rust
let mut parser = tree_sitter::Parser::new();
parser
    .set_language(&tree_sitter_elvish::language())
    .expect("Error loading Elvish grammar");
let tree = parser.parse("echo hello\n", None).unwrap();
```

The crate also exposes `NODE_TYPES`. Query constants are available but commented
out in `bindings/rust/lib.rs`; include them if you want embedded query text.

### C

The generated parser is in `src/parser.c`. Compile it into your project and call
`tree_sitter_elvish()`, declared in `src/tree_sitter/parser.h`'s language
function signature. Bindings for Node (`bindings/node`) and Rust
(`bindings/rust`) are thin wrappers around this parser.

## Building and testing

```sh
npm install                          # installs tree-sitter-cli ^0.26.9
npx tree-sitter generate --abi 14    # regenerate src/parser.c and friends
npm test                             # run the corpus tests (tree-sitter test)
```

`tree-sitter test` does not regenerate the parser. After editing `grammar.js`,
run `tree-sitter generate --abi 14` first or the tests exercise stale output.

Other checks:

```sh
npm run test:node                # Node binding smoke tests
npm run check:metadata           # package.json / Cargo.toml / tree-sitter.json in sync
node scripts/check-queries.mjs   # queries parse and produce expected captures
cargo test                       # Rust binding compiles and loads the grammar
npx tree-sitter parse file.elv   # inspect a parse tree
npx tree-sitter query -c queries/highlights.scm file.elv  # inspect captures
```

`src/parser.c`, `src/grammar.json`, and `src/node-types.json` are generated and
committed; do not hand-edit them. The corpus tests in `test/corpus/*.txt` are the
primary behavioral suite. `cargo test` does not run the corpus tests, and the
Node binding is built with `node-gyp` via `binding.gyp`.

## Editor and query usage

| File | Purpose |
| --- | --- |
| `queries/highlights.scm` | Syntax highlighting captures |
| `queries/injections.scm` | Language injections (currently none; comments only) |

The highlighted capture names follow Neovim conventions: functions, keywords,
variables, strings, numbers, operators, punctuation, comments, and parameters.
The grammar scope is `source.elvish` and the file type is `elv`, matching
`tree-sitter.json` and the legacy `package.json` metadata block.

When renaming or restructuring nodes in `grammar.js`, update the queries in the
same change or highlighting silently stops matching.

## License

0BSD. See [LICENSE](LICENSE).
