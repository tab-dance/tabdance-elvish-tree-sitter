// SPDX-License-Identifier: 0BSD
// SPDX-FileCopyrightText: 2022 Tobias Frilling

#include "tree_sitter/parser.h"

enum TokenType {
  EMPTY_ELEMENT,
  EMPTY_ELEMENT_AFTER_COMMA,
};

static bool is_space(int32_t c) {
  return c == ' ' || c == '\t' || c == '\r' || c == '\n' || c == '\f' ||
         c == '\v';
}

static void skip_extras(TSLexer *lexer) {
  for (;;) {
    if (lexer->eof(lexer)) {
      return;
    }
    if (is_space(lexer->lookahead)) {
      lexer->advance(lexer, true);
      continue;
    }
    if (lexer->lookahead == '#') {
      while (!lexer->eof(lexer) && lexer->lookahead != '\n') {
        lexer->advance(lexer, true);
      }
      continue;
    }
    if (lexer->lookahead == '^') {
      lexer->advance(lexer, true);
      if (!lexer->eof(lexer) && lexer->lookahead == '\r') {
        lexer->advance(lexer, true);
      }
      if (!lexer->eof(lexer) && lexer->lookahead == '\n') {
        lexer->advance(lexer, true);
      }
      continue;
    }
    return;
  }
}

void *tree_sitter_elvish_external_scanner_create(void) {
  return NULL;
}

void tree_sitter_elvish_external_scanner_destroy(void *payload) {
  (void)payload;
}

bool tree_sitter_elvish_external_scanner_scan(
    void *payload,
    TSLexer *lexer,
    const bool *valid_symbols
) {
  (void)payload;

  if (valid_symbols[EMPTY_ELEMENT]) {
    if (!lexer->eof(lexer) &&
        (lexer->lookahead == ',' || lexer->lookahead == '}')) {
      lexer->result_symbol = EMPTY_ELEMENT;
      return true;
    }
    return false;
  }

  if (valid_symbols[EMPTY_ELEMENT_AFTER_COMMA]) {
    skip_extras(lexer);
    if (!lexer->eof(lexer) &&
        (lexer->lookahead == ',' || lexer->lookahead == '}')) {
      lexer->result_symbol = EMPTY_ELEMENT_AFTER_COMMA;
      return true;
    }
  }

  return false;
}

unsigned tree_sitter_elvish_external_scanner_serialize(
    void *payload,
    char *buffer
) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_elvish_external_scanner_deserialize(
    void *payload,
    const char *buffer,
    unsigned length
) {
  (void)payload;
  (void)buffer;
  (void)length;
}
