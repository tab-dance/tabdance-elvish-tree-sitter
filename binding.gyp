# SPDX-License-Identifier: 0BSD
{
  "targets": [
    {
      "target_name": "tabdance_elvish_tree_sitter_binding",
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except",
      ],
      "include_dirs": [
        "elvish/src",
      ],
      "sources": [
        "bindings/node/binding.cc",
        "elvish/src/parser.c",
        "elvish/src/scanner.c",
        "elvish_transcript/src/parser.c",
        "elvish_transcript/src/scanner.c",
      ],
      "conditions": [
        ["OS!='win'", {
          "cflags_c": [
            "-std=c11",
          ],
        }, {
          "cflags_c": [
            "/std:c11",
            "/utf-8",
          ],
        }],
      ],
    }
  ]
}
