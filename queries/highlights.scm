;; SPDX-License-Identifier: 0BSD
;; SPDX-FileCopyrightText: 2022 Tobias Frilling

(comment) @comment

(if "if" @conditional)
(if (elif "elif" @conditional))
(if (else "else" @conditional))

(while "while" @repeat)
(while (else "else" @repeat))
(for "for" @repeat)
(for (else "else" @repeat))

(try "try" @exception)
(try (catch "catch" @exception))
(try (except "except" @exception))
(try (else "else" @exception))
(try (finally "finally" @exception))

(import "use" @include)
(import (bareword) @string.special)
(import (string) @string.special)

(wildcard ["*" "**" "?"] @string.special)

(command argument: (bareword) @parameter)
(command head: (bareword) @function)
(command head: (identifier) @function)
((command head: (identifier) @keyword.return)
 (#eq? @keyword.return "return"))
((command (identifier) @keyword.operator)
 (#any-of? @keyword.operator "and" "or" "coalesce"))
((command head: _ @function)
 (#any-of? @function
  "+" "-" "*" "/" "%" "<" "<=""==" "!=" ">"
  ">=" "<s" "<=s" "==s" "!=s" ">s" ">=s"
))

(pipeline "|" @operator)
(redirection [">" "<" ">>" "<>"] @operator)

(io_port) @number

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
(string) @string

(variable [(identifier) (string)] @variable)
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
