// SPDX-License-Identifier: 0BSD
const assert = require("node:assert");
const { test } = require("node:test");

const Parser = require("tree-sitter");
const elvish = require(".");
const elvishTranscript = require(".").elvish_transcript;

test("can load grammar", () => {
  const parser = new Parser();
  assert.doesNotThrow(() => parser.setLanguage(elvish));
});

test("can parse elvish", () => {
  const parser = new Parser();
  parser.setLanguage(elvish);
  const tree = parser.parse("echo hello\n");
  assert.equal(tree.rootNode.type, "source_file");
  assert.equal(tree.rootNode.hasError, false);
});

test("exposes node type info", () => {
  assert.equal(elvish.name, "elvish");
  assert.ok(Array.isArray(elvish.nodeTypeInfo));
  assert.ok(elvish.nodeTypeInfo.length > 0);
});

test("parses empty braced list elements", () => {
  const parser = new Parser();
  parser.setLanguage(elvish);
  const tree = parser.parse("put {a,,b}\n");
  assert.equal(tree.rootNode.hasError, false);
  const bracedList = tree.rootNode.firstChild.childForFieldName("argument");
  assert.deepEqual(
    bracedList.namedChildren.map((child) => child.type),
    ["bareword", "empty_element", "bareword"],
  );
});

test("can parse elvish transcript", () => {
  const parser = new Parser();
  parser.setLanguage(elvishTranscript);
  const tree = parser.parse("~> echo hello\nhello\n");
  assert.equal(tree.rootNode.type, "source_file");
  assert.equal(tree.rootNode.hasError, false);
});
