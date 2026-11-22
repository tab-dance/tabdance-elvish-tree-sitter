// SPDX-License-Identifier: 0BSD
// SPDX-FileCopyrightText: 2022 Tobias Frilling

const chunk = ($) => seq(
  repeat($._terminator),
  optional(alias($._statements, $.chunk))
);

module.exports = grammar({
  name: 'elvish',

  extras: $ => [
    /\s/,
    /\^\r?\n/,
    $.comment
  ],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.option],
    [$._command_body],
  ],


  inline: $ => [
    $._statement,
    $._expression,
    $._literal,
    $._string_like,
    $._terminator,
    $._lhs_var,
  ],

  rules: {
    source_file: $ => seq(repeat($._terminator), optional($._statements)),

    comment: $ => token(seq('#', /.*/)),

    _statements: $ => seq(
      $._statement,
      repeat(seq(
        repeat1($._terminator),
        $._statement
      )),
      repeat($._terminator)
    ),

    _statement: $ => choice(
      alias($.background_command, $.command),
      $.command,
      $.if,
      $.while,
      $.for,
      $.try,
      $.import,
      $.function_definition,
      $.variable_declaration,
      $.variable_assignment,
      $.temporary_assignment,
      $.variable_deletion,
      $.pipeline,
    ),

    _expression: $ => choice(
      $._literal,
      $.variable,
      $.output_capture,
      $.exception_capture,
      $.braced_list,
      $.indexing,
      $.lambda,
      $.wildcard
    ),

    _literal: $ => choice(
      $.number,
      $._string_like,
      $.list,
      $.map,
    ),

    _terminator: $ => choice(";", "\n"),

    identifier: $ => /(?:[\p{L}\p{N}_:~-]|[^\x00-\x7F])+/,


    // ==========
    // Statements
    // ==========
    //

    import: $ => seq(
      "use",
      repeat1(choice($._expression, $.option))
    ),

    _command_body: $ => seq(
      field("head", choice(
        alias($.head_indexing, $.indexing),
        $.identifier,
        $.bareword,
        alias($.cmd_bareword, $.bareword),
        $.variable,
        $.output_capture,
        $.exception_capture,
        $.string,
        $.list,
        $.map,
        $.braced_list,
        $.lambda,
        $.wildcard,
        $.indexing,
      )),
      repeat(choice(
        field("argument", $._expression),
        $.option,
        $.redirection,
      )),
    ),

    command: $ => $._command_body,

    background_command: $ => seq($._command_body, "&"),

    pipeline: $ => seq(
      repeat1(seq($.command, "|")),
      choice($.command, alias($.background_command, $.command))
    ),

    redirection: $ => {
      const port = token(
        choice(/\d+/, "-", "stdin", "stdout", "stderr")
      )
      const portRedir = choice(
        seq(port, token.immediate(">>")),
        seq(port, token.immediate("<>")),
        seq(port, token.immediate(">")),
        seq(port, token.immediate("<")),
      )
      return seq(
        choice(
          ">", "<", ">>", "<>",
          // Why do I have to wrap this in a token?
          alias(token(portRedir), $.io_port),
        ),
        choice(
          alias($._expression, $.file),
          alias(token(seq(optional("&"), port)), $.io_port)
        )
      )
    },

    variable_declaration: $ => seq("var", $._assignment),

    variable_assignment: $ => seq("set", $._assignment),

    temporary_assignment: $ => seq("tmp", $._assignment),

    variable_deletion: $ => seq(
      "del", repeat1(choice($.identifier, $.string))
    ),

    _assignment: $ => seq(
      alias(repeat1($._lhs_var), $.lhs),
      optional(seq(
        "=",
        alias(repeat1($._expression), $.rhs)
      ))
    ),

    _lhs_var: $ => seq(
      optional("@"),
      choice($.identifier, $.string),
      repeat(seq(
        token.immediate("["),
        alias(repeat1($._expression), $.indices),
        "]"
      ))
    ),

    function_definition: $ => seq(
      "fn", choice($.identifier, $.string), $.lambda
    ),

    if: $ => seq(
      "if", field("condition", $._expression),
      "{", chunk($), "}",
      repeat($.elif),
      optional($.else),
    ),

    elif: $ => seq(
      "elif", field("condition", $._expression),
      "{", chunk($), "}"
    ),

    else: $ => seq("else", "{", chunk($), "}"),

    while: $ => seq(
      "while", field("condition", $._expression),
      "{", chunk($), "}",
      optional($.else),
    ),

    for: $ => seq(
      "for",
      field("var", $.identifier),
      field("container", $._expression),
      "{", chunk($), "}",
      optional($.else),
    ),

    try: $ => seq(
      "try", "{", chunk($), "}",
      optional(seq($.catch, optional($.else))),
      optional($.finally),
    ),

    catch: $ => seq(
      "catch", field("exception", $.identifier),
      "{", chunk($), "}"
    ),

    finally: $ => seq("finally", "{", chunk($), "}"),


    // ===========
    // Expressions
    // ===========

    lambda: $ => seq(
      "{",
      choice(
        $.parameter_list,
        seq(choice(/\s+/, ";"), optional($.parameter_list)),
      ),
      chunk($),
      "}"
    ),

    parameter_list: $ => seq(
      "|",
      repeat(field(
        "parameter",
        choice(
          alias($.parameter_option, $.option),
          alias(token(prec(1, seq("@", /(?:[\p{L}\p{N}_:~-]|[^\x00-\x7F])+/))), $.identifier),
          seq(
            optional("@"),
            choice($.identifier, $.bareword, $.string)
          ),
        )
      )),
      "|"
    ),

    parameter_option: $ => choice(
      prec(1, seq(
        "&",
        field("key", $.option_key),
        token(prec(1, "=")),
        field("value", $._expression)
      )),
      seq("&", field("key", $.option_key))
    ),

    option_key: $ => seq(
      $._option_key_part,
      repeat($._option_key_part),
      repeat(seq(
        token.immediate("["),
        alias(repeat1($._expression), $.indices),
        "]"
      ))
    ),

    _option_key_part: $ => choice(
      alias(token.immediate(/(?:[\p{L}\p{N}_:~-]|[^\x00-\x7F])+/), $.identifier),
      alias(token.immediate(seq("'", /([^']|'')*/, "'")), $.string),
      alias(token.immediate(seq('"', /([^"\\]|\\.)*/, '"')), $.string),
      alias(token.immediate(/(?:[\p{L}\p{N}!%+,./:@\\_~-]|[^\x00-\x7F])+/), $.bareword),
    ),

    option: $ => seq(
      "&",
      field("key", $.option_key),
      optional(choice(
        prec.dynamic(1, seq(
          token(prec(1, "=")),
          field("value", $._expression)
        )),
        token(prec(1, "="))
      ))
    ),

    head_indexing: $ => seq(
      $.identifier,
      repeat1(seq(
        token.immediate("["),
        alias(repeat1($._expression), $.indices),
        "]"
      ))
    ),

    indexing: $ => seq(
      choice(
        $.variable,
        $.string,
        $.bareword,
        $.list,
        $.map,
        $.output_capture,
        $.exception_capture,
        $.braced_list,
        $.lambda,
      ),
      repeat1(seq(
        token.immediate("["),
        alias(repeat1($._expression), $.indices),
        "]"
      )),
    ),

    braced_list: $ => seq(
      "{", repeat($._expression), "}"
    ),

    output_capture: $ => seq(
      "(", chunk($), ")"
    ),

    exception_capture: $ => seq(
      "?(", chunk($), ")"
    ),

    variable: $ => seq(
      "$", optional("@"), choice($.identifier, $.string)
    ),

    number: $ => {
      const decimal = /\d(_?\d)*/
      const integer = choice(
        decimal,
        seq(choice("0x", "0X"), /[\da-fA-F](_?[\da-fA-F])*/),
        seq(choice("0o", "0O"), /[0-7](_?[0-7])*/),
        seq(choice('0b', '0B'), /[0-1](_?[0-1])*/),
      )
      return token(seq(
        optional(choice("+", "-")),
        choice(
          integer,
          seq(integer, "/", integer),
          seq(
            choice(
              seq(decimal, optional("."), optional(decimal)),
              seq(".", decimal)
            ),
            optional(seq(/[eE][+-]?/, decimal))
          ),
          "Inf",
          "NaN"
        )
      ))
    },

    _string_like: $ => choice($.string, $.bareword),

    string: $ => token(choice(
      seq("'", /([^']|'')*/, "'"),
      seq('"', /([^"\\]|\\.)*/, '"')
    )),

    bareword: $ => /(?:[\p{L}\p{N}!%+,./:@\\_~=-]|[^\x00-\x7F])+/,

    // Barewords in command position may also contain <, >, * and ^.
    cmd_bareword: $ => token(prec(1, seq(
      /(?:[\p{L}\p{N}!%+,./:@\\_~=-]|[^\x00-\x7F])*/,
      /[<>*^]/,
      /(?:[\p{L}\p{N}!%+,./:@\\_~=<>*^-]|[^\x00-\x7F])*/
    ))),

    wildcard: $ => seq(
      choice("*", "**", "?"),
      repeat(seq(
        token.immediate("["),
        alias($._expression, $.modifier),
        "]"
      ))
    ),

    list: $ => seq("[", repeat($._expression), "]"),

    map: $ => seq(
      "[",
      choice(
        seq("&", "]"),
        seq($.pair, repeat($.pair), "]")
      )
    ),

    pair: $ => seq(
      "&",
      field("key", $.option_key),
      optional(prec.right(seq(
        token(prec(1, "=")),
        optional(field("value", $._expression))
      )))
    ),
  }
});
