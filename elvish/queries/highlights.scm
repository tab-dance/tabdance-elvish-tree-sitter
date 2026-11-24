;; SPDX-License-Identifier: 0BSD
;; SPDX-FileCopyrightText: 2022 Tobias Frilling

(comment) @comment
(string) @string

(if "if" @conditional)
(if (elif "elif" @conditional))
(if (else "else" @conditional))

(while "while" @repeat)
(while (else "else" @repeat))
(for "for" @repeat)
(for (else "else" @repeat))

(try "try" @exception)
(try (catch "catch" @exception))
(try (else "else" @exception))
(try (finally "finally" @exception))

(import "use" @include)
(import (bareword) @string.special)
(import (string) @string.special)

(wildcard) @string.special
(tilde) @string.special

(command argument: (bareword) @parameter)
(command head: (bareword) @function)
(command head: (identifier) @function)
((command head: (identifier) @keyword.return)
 (#eq? @keyword.return "return"))
((command (identifier) @keyword.operator)
 (#any-of? @keyword.operator "and" "or" "coalesce"))
((command head: (identifier) @keyword)
 (#eq? @keyword "pragma"))
((command head: _ @function)
 (#any-of? @function
  "+" "-" "*" "/" "%" "<" "<=""==" "!=" ">"
  ">=" "<s" "<=s" "==s" "!=s" ">s" ">=s"
))

(pipeline "|" @operator)
(redirection [">" "<" ">>" "<>"] @operator)
((redirection (io_port) @operator)
 (#match? @operator "[<>]"))

((io_port) @number
 (#match? @number "^[&]?[0-9-]+$"))

(function_definition
  "fn" @keyword.function
  name: [(identifier) (string) (bareword)] @function)

(parameter_list) @parameter
(parameter_list "|" @punctuation.bracket)

(variable_declaration
  "var" @keyword
  (lhs [(identifier) (string)] @variable))

(variable_assignment
  "set" @keyword
  (lhs [(identifier) (string)] @variable))

(temporary_assignment
  "tmp" @keyword
  (lhs [(identifier) (string)] @variable))

(variable_deletion
  "del" @keyword
  [(identifier) (string)] @variable)


(number) @number

(option_key (identifier) @property)
(option_key (string) @property)
(option_key (bareword) @property)

(variable (identifier) @variable)
(variable (string) @variable)
((variable (identifier) @function)
  (#match? @function ".+\\~$"))
((variable (identifier) @boolean)
 (#any-of? @boolean "true" "false"))
((variable (identifier) @constant.builtin)
 (#any-of? @constant.builtin
  "_" "after-chdir" "args" "before-chdir" "buildinfo" "nil"
  "notify-bg-job-success" "num-bg-jobs" "ok" "paths" "pid"
  "pwd" "value-out-indicator" "version"))

["$" "@"] @punctuation.special
["(" ")" "[" "]" "{" "}"] @punctuation.bracket
";" @punctuation.delimiter
