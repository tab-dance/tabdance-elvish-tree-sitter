; SPDX-License-Identifier: 0BSD

(function_definition) @function.around

(function_definition
  (lambda
    (chunk) @function.inside))

(lambda) @function.around

(lambda
  (chunk) @function.inside)

(parameter_list
  parameter: (_) @parameter.inside)

(command
  argument: (_) @parameter.inside)

(comment) @comment.inside

(comment)+ @comment.around

(pair) @entry.around

(pair
  value: (_) @entry.inside)
