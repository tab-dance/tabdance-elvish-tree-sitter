// SPDX-License-Identifier: 0BSD

module.exports = grammar({
  name: "elvish_transcript",

  extras: $ => [],

  externals: $ => [
    $.prompt,
    $.continuation_prefix,
    $._output_line,
    $._heading_line,
    $._comment_line,
    $._directive_line,
  ],

  rules: {
    source_file: $ => repeat($._line),

    _line: $ => choice(
      $.heading,
      $.directive,
      $.comment,
      $.interaction,
      $.output,
      $._blank_line,
    ),

    _blank_line: $ => /\r?\n/,

    heading: $ => $._heading_line,

    comment: $ => $._comment_line,

    directive: $ => $._directive_line,

    interaction: $ => seq(
      $.prompt_line,
      repeat($.continuation_line),
    ),

    prompt_line: $ => seq(
      $.prompt,
      optional($.code),
      /\r?\n/,
    ),

    continuation_line: $ => seq(
      $.continuation_prefix,
      optional($.code),
      /\r?\n/,
    ),

    code: $ => token(/[^\r\n]+/),

    output: $ => $._output_line,
  },
});
