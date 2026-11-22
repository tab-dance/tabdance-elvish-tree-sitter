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
    token(prec(2, /\^\r?\n/)),
    $.comment
  ],

  word: $ => $.identifier,

  conflicts: $ => [
    [$.option],
    [$._command_body],
    [$._assignment, $.indexing],
    [$.variable_deletion, $.indexing],
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
      $.compound,
      $._literal,
      $.variable,
      $.output_capture,
      $.exception_capture,
      $.braced_list,
      $.indexing,
      $.lambda,
      $.wildcard
    ),

    compound: $ => prec.left(seq(
      choice(
        $.number,
        $._string_like,
        $.variable,
        $.output_capture,
        $.exception_capture,
        $.braced_list,
        $.lambda,
        $.wildcard,
        $.indexing,
      ),
      repeat1(choice(
        alias($.immediate_variable, $.variable),
        alias($.immediate_output_capture, $.output_capture),
        alias($.immediate_exception_capture, $.exception_capture),
        alias($.immediate_braced_list, $.braced_list),
        alias($.immediate_lambda, $.lambda),
        alias($.immediate_wildcard, $.wildcard),
        alias(token.immediate(seq("'", /([^']|'')*/, "'")), $.string),
        alias(token.immediate(seq('"', /([^"\\]|\\.)*/, '"')), $.string),
        alias(token.immediate(/(?:[\p{L}\p{N}!%+,./:@\\_~=-]|[^\x00-\x7F])+/), $.bareword),
      ))
    )),

    immediate_variable: $ => seq(
      token.immediate("$"),
      optional(token.immediate("@")),
      choice(
        alias(token.immediate(/(?:[\p{L}\p{N}_:~-]|[^\x00-\x7F])+/), $.identifier),
        alias(token.immediate(seq("'", /([^']|'')*/, "'")), $.string),
        alias(token.immediate(seq('"', /([^"\\]|\\.)*/, '"')), $.string),
      )
    ),
    immediate_output_capture: $ => seq(token.immediate("("), chunk($), ")"),
    immediate_exception_capture: $ => seq(token.immediate("?("), chunk($), ")"),
    immediate_braced_list: $ => seq(
      token.immediate("{"),
      repeat(choice(",", $._braced_expression)),
      "}"
    ),
    immediate_lambda: $ => seq(
      token.immediate("{"),
      choice(
        $.parameter_list,
        seq(choice(/\s+/, ";"), optional($.parameter_list)),
      ),
      chunk($),
      "}"
    ),
    immediate_wildcard: $ => token.immediate(choice("*", "**", "?")),

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
        $.redirection,
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
      const op = choice(">", "<", ">>", "<>");
      const immediateOp = choice(
        token.immediate(">"),
        token.immediate("<"),
        token.immediate(">>"),
        token.immediate("<>"),
      );
      const target = choice(
        alias($._expression, $.file),
        alias(token(seq(optional("&"), port)), $.io_port)
      );
      return choice(
        prec(1, seq(field("source", $._expression), immediateOp, target)),
        seq(choice(op, alias(token(portRedir), $.io_port)), target),
      )
    },

    variable_declaration: $ => seq("var", $._assignment),

    variable_assignment: $ => seq("set", $._assignment),

    temporary_assignment: $ => seq("tmp", $._assignment),

    variable_deletion: $ => seq(
      "del", repeat1($._lhs_var)
    ),

    _assignment: $ => seq(
      alias(repeat1($._lhs_var), $.lhs),
      optional(seq(
        "=",
        alias(repeat1($._expression), $.rhs)
      ))
    ),

    _lhs_var: $ => choice(
      seq(
        optional("@"),
        choice($.identifier, $.string, $.variable),
        repeat(seq(
          token.immediate("["),
          alias(repeat1($._expression), $.indices),
          "]"
        ))
      ),
      $._expression,
    ),

    function_definition: $ => seq(
      "fn", field("name", choice($.identifier, $.string, $.bareword)), $.lambda
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
      field("var", choice($.identifier, $.string, $.variable)),
      field("container", $._expression),
      "{", chunk($), "}",
      optional($.else),
    ),

    try: $ => seq(
      "try", "{", chunk($), "}",
      optional(seq(choice($.catch, $.except), optional($.else))),
      optional($.finally),
    ),

    catch: $ => seq(
      "catch", optional(field("exception", choice($.identifier, $.string, $.variable))),
      "{", chunk($), "}"
    ),

    except: $ => seq(
      "except", optional(field("exception", choice($.identifier, $.string, $.variable))),
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

    indexing: $ => prec.left(seq(
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
        $.wildcard,
      ),
      repeat1(seq(
        token.immediate("["),
        alias(repeat1($._expression), $.indices),
        "]"
      )),
    )),

    braced_list: $ => seq(
      "{",
      repeat(choice(",", $._braced_expression)),
      "}"
    ),

    _braced_expression: $ => choice(
      alias($.braced_compound, $.compound),
      alias($._braced_bareword, $.bareword),
      $.string,
      $.number,
      $.variable,
      $.output_capture,
      $.exception_capture,
      $.braced_list,
      alias($.braced_indexing, $.indexing),
      $.lambda,
      $.wildcard,
      $.list,
      $.map,
    ),

    braced_compound: $ => prec.left(seq(
      choice(
        $.number,
        $.string,
        alias($._braced_bareword, $.bareword),
        $.variable,
        $.output_capture,
        $.exception_capture,
        $.braced_list,
        $.lambda,
        $.wildcard,
        alias($.braced_indexing, $.indexing),
      ),
      repeat1(choice(
        alias($.immediate_variable, $.variable),
        alias($.immediate_output_capture, $.output_capture),
        alias($.immediate_exception_capture, $.exception_capture),
        alias($.immediate_braced_list, $.braced_list),
        alias($.immediate_lambda, $.lambda),
        alias($.immediate_wildcard, $.wildcard),
        alias(token.immediate(seq("'", /([^']|'')*/, "'")), $.string),
        alias(token.immediate(seq('"', /([^"\\]|\\.)*/, '"')), $.string),
        alias(token.immediate(/(?:[\p{L}\p{N}!%+./:@\\_~=-]|[^\x00-\x7F])+/), $.bareword),
      ))
    )),

    braced_indexing: $ => prec.left(seq(
      choice(
        $.variable,
        $.string,
        alias($._braced_bareword, $.bareword),
        $.list,
        $.map,
        $.output_capture,
        $.exception_capture,
        $.braced_list,
        $.lambda,
        $.wildcard,
      ),
      repeat1(seq(
        token.immediate("["),
        alias(repeat1($._expression), $.indices),
        "]"
      )),
    )),

    _braced_bareword: $ => /(?:[\p{L}\p{N}!%+./:@\\_~=-]|[^\x00-\x7F])+/,

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

    wildcard: $ => choice(
      token(prec(2, choice("*", "**"))),
      token(prec(-1, "?")),
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
