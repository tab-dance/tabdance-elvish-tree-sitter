tree-sitter-elvish
================

[Elvish](https://elv.sh) and Elvish transcript grammars for
[tree-sitter](https://github.com/tree-sitter/tree-sitter).

This repository contains two grammars:

- `elvish` (`source.elvish`, `.elv`) for Elvish source files.
- `elvish_transcript` (`source.elvish-transcript`, `.elvts`) for Elvish
  transcript tests, with injected `source.elvish` highlighting for prompt/code
  lines.

The Elvish grammar covers expressions, statements, pipelines, redirections,
lambdas, lists/maps, string literals, and compound concatenation, plus syntax
highlighting queries for editors.

#### References

* [Elvish Language Specification](https://elv.sh/ref/language.html)
* [Elvish transcript syntax](https://pkg.go.dev/src.elv.sh/pkg/transcript)
* [tree-sitter documentation](https://tree-sitter.github.io/tree-sitter/)

## Supported versions

| Component | Version |
| --- | --- |
| Grammar ABI | 14 (`LANGUAGE_VERSION 14`) |
| tree-sitter CLI | 0.26.x (pinned `^0.26.9` in `package.json`) |
| Rust `tree-sitter-language` crate | 0.1 |
| Rust `tree-sitter` dev dependency | 0.26 |
| Node `tree-sitter` package | 0.25.x |
| Elvish | No version gate; tracks the current language specification |

The parsers are generated with `--abi 14` so they can be loaded by editors and
runtimes that have not adopted ABI 15 yet. Regenerate parsers after upgrading
the CLI, since the CLI also emits runtime headers in `*/src/tree_sitter/`.

## Installation

### Neovim

This repository ships queries in the grammar layout (`elvish/queries/*.scm`,
`elvish_transcript/queries/*.scm`). Neovim looks for
`queries/<language>/<query>.scm` on `runtimepath`, so copy them into place:

```sh
mkdir -p ~/.config/nvim/queries/elvish ~/.config/nvim/queries/elvish_transcript
cp elvish/queries/*.scm ~/.config/nvim/queries/elvish/
cp elvish_transcript/queries/*.scm ~/.config/nvim/queries/elvish_transcript/
```

Build the parsers:

```sh
npx tree-sitter build elvish -o ~/.config/nvim/parser/elvish.so
npx tree-sitter build elvish_transcript -o ~/.config/nvim/parser/elvish_transcript.so
```

Register filetypes:

```lua
vim.filetype.add({
  extension = {
    elv = "elvish",
    elvts = "elvish_transcript",
  },
})
```

### Helix

Add languages to `languages.toml` and copy queries into Helix's runtime:

```toml
[[language]]
name = "elvish"
scope = "source.elvish"
file-types = ["elv"]
comment-token = "#"
grammar = "elvish"

[[language]]
name = "elvish_transcript"
scope = "source.elvish-transcript"
file-types = ["elvts"]
comment-token = "//"
grammar = "elvish_transcript"
```

Put query files in `runtime/queries/elvish/` and
`runtime/queries/elvish_transcript/`, then build with `hx --grammar build`.

### Node.js

```js
const Parser = require("tree-sitter");
const Elvish = require("tree-sitter-elvish");
const ElvishTranscript = require("tree-sitter-elvish").elvish_transcript;

const parser = new Parser();
parser.setLanguage(Elvish);
console.log(parser.parse("echo hello\n").rootNode.toString());

parser.setLanguage(ElvishTranscript);
console.log(parser.parse("~> echo hello\nhello\n").rootNode.toString());
```

### Rust

```rust
let mut parser = tree_sitter::Parser::new();
parser
    .set_language(&tree_sitter_elvish::LANGUAGE_ELVISH.into())
    .expect("Error loading Elvish grammar");

let mut transcript_parser = tree_sitter::Parser::new();
transcript_parser
    .set_language(&tree_sitter_elvish::LANGUAGE_ELVISH_TRANSCRIPT.into())
    .expect("Error loading Elvish transcript grammar");
```

The crate also exposes `LANGUAGE` (Elvish alias), `language()`,
`language_elvish_transcript()`, node type constants, and query constants.

## Building and testing

```sh
npm install
npx tree-sitter generate --abi 14 elvish/grammar.js -o elvish/src
npx tree-sitter generate --abi 14 elvish_transcript/grammar.js -o elvish_transcript/src
npm test
```

`npm test` builds both grammars and runs their corpus tests.

Other checks:

```sh
npm run test:node
npm run check:metadata
npm run check:queries
cargo test
```

`elvish/src/*` and `elvish_transcript/src/*` generated parser files are
committed; do not hand-edit them. Corpus tests in `elvish/test/corpus/` and
`elvish_transcript/test/corpus/` are the primary behavioral suites.

## Queries

| File | Purpose |
| --- | --- |
| `elvish/queries/highlights.scm` | Elvish syntax highlighting |
| `elvish/queries/injections.scm` | Elvish injections (currently none) |
| `elvish_transcript/queries/highlights.scm` | Transcript prompts/headings/comments/directives/output |
| `elvish_transcript/queries/injections.scm` | Injects `elvish` into transcript `code` nodes |

## License

0BSD. See [LICENSE](LICENSE).
