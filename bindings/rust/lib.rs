// SPDX-License-Identifier: 0BSD
//! This crate provides Elvish and Elvish transcript language support for the [tree-sitter][] parsing library.
//!
//! ```
//! let code = "echo hello\n";
//! let mut parser = tree_sitter::Parser::new();
//! parser
//!     .set_language(&tree_sitter_elvish::LANGUAGE_ELVISH.into())
//!     .expect("Error loading elvish grammar");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

extern "C" {
    fn tree_sitter_elvish() -> *const ();
    fn tree_sitter_elvish_transcript() -> *const ();
}

/// The tree-sitter [`LanguageFn`] for Elvish.
pub const LANGUAGE_ELVISH: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_elvish) };

/// The tree-sitter [`LanguageFn`] for Elvish transcript.
pub const LANGUAGE_ELVISH_TRANSCRIPT: LanguageFn =
    unsafe { LanguageFn::from_raw(tree_sitter_elvish_transcript) };

/// Backward-compatible alias for the Elvish language.
pub const LANGUAGE: LanguageFn = LANGUAGE_ELVISH;

/// Get the tree-sitter [LanguageFn][] for Elvish.
pub fn language() -> LanguageFn {
    LANGUAGE_ELVISH
}

/// Get the tree-sitter [LanguageFn][] for Elvish transcript.
pub fn language_elvish_transcript() -> LanguageFn {
    LANGUAGE_ELVISH_TRANSCRIPT
}

/// The content of the [`node-types.json`][] file for Elvish.
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types
pub const NODE_TYPES: &str = include_str!("../../elvish/src/node-types.json");

/// The content of the [`node-types.json`][] file for Elvish transcript.
pub const ELVISH_TRANSCRIPT_NODE_TYPES: &str =
    include_str!("../../elvish_transcript/src/node-types.json");

/// The syntax highlighting query for Elvish.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../elvish/queries/highlights.scm");

/// The injections query for Elvish.
pub const INJECTIONS_QUERY: &str = include_str!("../../elvish/queries/injections.scm");

/// The syntax highlighting query for Elvish transcript.
pub const ELVISH_TRANSCRIPT_HIGHLIGHTS_QUERY: &str =
    include_str!("../../elvish_transcript/queries/highlights.scm");

/// The injections query for Elvish transcript.
pub const ELVISH_TRANSCRIPT_INJECTIONS_QUERY: &str =
    include_str!("../../elvish_transcript/queries/injections.scm");

#[cfg(test)]
mod tests {
    #[test]
    fn test_can_load_elvish_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE_ELVISH.into())
            .expect("Error loading elvish language");
    }

    #[test]
    fn test_can_load_elvish_transcript_grammar() {
        let mut parser = tree_sitter::Parser::new();
        parser
            .set_language(&super::LANGUAGE_ELVISH_TRANSCRIPT.into())
            .expect("Error loading elvish transcript language");
    }
}
