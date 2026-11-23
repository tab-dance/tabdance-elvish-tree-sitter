// SPDX-License-Identifier: 0BSD
const root = require("path").join(__dirname, "..", "..");

const binding =
  typeof process.versions.bun === "string"
    ? require(`../../prebuilds/${process.platform}-${process.arch}/tree-sitter-elvish.node`)
    : require("node-gyp-build")(root);

const elvish = binding.elvish;
const elvishTranscript = binding.elvish_transcript;

module.exports = elvish;
module.exports.elvish = elvish;
module.exports.elvish_transcript = elvishTranscript;
module.exports.name = elvish.name;
module.exports.language = elvish.language;

try {
  const nodeTypeInfo = require("../../elvish/src/node-types.json");
  elvish.nodeTypeInfo = nodeTypeInfo;
  module.exports.nodeTypeInfo = nodeTypeInfo;
} catch (_) {}
try {
  elvishTranscript.nodeTypeInfo = require("../../elvish_transcript/src/node-types.json");
} catch (_) {}
