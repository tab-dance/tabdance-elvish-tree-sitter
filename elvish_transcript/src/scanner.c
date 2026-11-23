// SPDX-License-Identifier: 0BSD

#include "tree_sitter/parser.h"
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

enum TokenType {
  PROMPT,
  CONTINUATION_PREFIX,
  OUTPUT_LINE,
  HEADING_LINE,
  COMMENT_LINE,
  DIRECTIVE_LINE,
};

typedef struct {
  bool in_interaction;
  uint16_t prompt_len;
} Scanner;

static bool is_newline(int32_t c) { return c == '\n' || c == '\r'; }
static void adv(TSLexer *lexer) { lexer->advance(lexer, false); }

static void scan_to_eol(TSLexer *lexer) {
  while (!lexer->eof(lexer) && !is_newline(lexer->lookahead)) adv(lexer);
  if (lexer->lookahead == '\r') adv(lexer);
  if (lexer->lookahead == '\n') adv(lexer);
}

static bool scan_continuation(TSLexer *lexer, Scanner *scanner) {
  if (!scanner->in_interaction || scanner->prompt_len == 0) return false;
  if (lexer->get_column(lexer) != 0) return false;
  for (uint16_t i = 0; i < scanner->prompt_len; i++) {
    if (lexer->lookahead != ' ') return false;
    adv(lexer);
  }
  lexer->mark_end(lexer);
  lexer->result_symbol = CONTINUATION_PREFIX;
  return true;
}

static bool scan_heading(TSLexer *lexer) {
  if (lexer->get_column(lexer) != 0 || lexer->lookahead != '#') return false;
  uint32_t hashes = 0;
  while (lexer->lookahead == '#' && hashes < 4) {
    adv(lexer);
    hashes++;
  }
  if (hashes < 1 || hashes > 3) return false;
  if (lexer->lookahead != ' ') return false;
  scan_to_eol(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = HEADING_LINE;
  return true;
}

static bool scan_tilde_or_slash_line(TSLexer *lexer, Scanner *scanner, const bool *valid_symbols) {
  // Handles lines starting with ~ or / at col 0. Must distinguish:
  // - prompt: ^[~/][^ ]*>  (space after >-terminated token)
  // - comment: // ... or ////
  // - directive: //not-a-comment
  // - output: anything else
  if (lexer->get_column(lexer) != 0) return false;
  int32_t first = lexer->lookahead;
  if (first != '~' && first != '/') return false;

  uint32_t col = 0;
  bool saw_gt = false;
  bool all_slash = (first == '/');
  int32_t second = 0;
  int32_t third = 0;

  // Scan the "prompt prefix" candidate: chars until space/newline/eof.
  while (!lexer->eof(lexer) && !is_newline(lexer->lookahead) && lexer->lookahead != ' ') {
    int32_t c = lexer->lookahead;
    if (c == '>') saw_gt = true;
    if (c != '/') all_slash = false;
    if (col == 1) second = c;
    if (col == 2) third = c;
    adv(lexer);
    col++;
    if (col > 4096) break;
  }

  bool at_space = (lexer->lookahead == ' ');
  bool is_prompt = valid_symbols[PROMPT] && saw_gt && at_space;

  if (is_prompt) {
    adv(lexer); // include trailing space in prompt token
    lexer->mark_end(lexer);
    lexer->result_symbol = PROMPT;
    scanner->in_interaction = true;
    scanner->prompt_len = (uint16_t)(col + 1);
    return true;
  }

  // Not a prompt - consume rest of line, tracking all_slash and 2nd/3rd chars.
  if (all_slash && at_space) all_slash = false;
  if (col == 1 && at_space) {
    // line is "/ " - second was never set; space is not in line content before space
  }
  while (!lexer->eof(lexer) && !is_newline(lexer->lookahead)) {
    int32_t c = lexer->lookahead;
    if (c != '/') all_slash = false;
    if (col == 1) second = c;
    if (col == 2) third = c;
    adv(lexer);
    col++;
  }
  // if line ended at space in first loop, col==1 means only first char seen; second is space
  if (at_space && col == 1) second = ' ';
  if (at_space && col == 2) third = ' ';

  if (lexer->lookahead == '\r') adv(lexer);
  if (lexer->lookahead == '\n') adv(lexer);
  lexer->mark_end(lexer);

  if (first == '/' && col >= 2) {
    bool comment = all_slash || (second == '/' && third == ' ') || (second == '/' && col == 2);
    // "////" all_slash => comment. "// " (len>=3, second '/', third ' ') => comment.
    // "//" exactly (col==2, second '/') => comment (slash-only comment per parser: ^///*$ matches //).
    // "//foo" (second '/', third != ' ') => directive.
    if (all_slash) comment = true;
    else if (second == '/' && third == ' ') comment = true;
    else if (second == '/' && col == 2) comment = true;
    else comment = false;

    bool directive = (second == '/') && !comment;

    if (comment && valid_symbols[COMMENT_LINE]) {
      lexer->result_symbol = COMMENT_LINE;
      return true;
    }
    if (directive && valid_symbols[DIRECTIVE_LINE]) {
      lexer->result_symbol = DIRECTIVE_LINE;
      return true;
    }
  }

  if (valid_symbols[OUTPUT_LINE]) {
    lexer->result_symbol = OUTPUT_LINE;
    scanner->in_interaction = false;
    return true;
  }
  return false;
}

static bool scan_output_line(TSLexer *lexer, Scanner *scanner) {
  if (lexer->get_column(lexer) != 0) return false;
  if (lexer->eof(lexer) || is_newline(lexer->lookahead)) return false;
  scan_to_eol(lexer);
  lexer->mark_end(lexer);
  lexer->result_symbol = OUTPUT_LINE;
  scanner->in_interaction = false;
  return true;
}

void *tree_sitter_elvish_transcript_external_scanner_create(void) {
  Scanner *s = (Scanner *)calloc(1, sizeof(Scanner));
  return s;
}

void tree_sitter_elvish_transcript_external_scanner_destroy(void *payload) {
  free(payload);
}

unsigned tree_sitter_elvish_transcript_external_scanner_serialize(void *payload, char *buffer) {
  Scanner *s = (Scanner *)payload;
  buffer[0] = s->in_interaction ? 1 : 0;
  memcpy(buffer + 1, &s->prompt_len, sizeof(s->prompt_len));
  return 1 + sizeof(s->prompt_len);
}

void tree_sitter_elvish_transcript_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
  Scanner *s = (Scanner *)payload;
  s->in_interaction = false;
  s->prompt_len = 0;
  if (length >= 1 + sizeof(s->prompt_len)) {
    s->in_interaction = buffer[0] != 0;
    memcpy(&s->prompt_len, buffer + 1, sizeof(s->prompt_len));
  }
}

bool tree_sitter_elvish_transcript_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;
  if (lexer->eof(lexer) || lexer->get_column(lexer) != 0) return false;

  if (valid_symbols[CONTINUATION_PREFIX] && scan_continuation(lexer, scanner)) return true;

  int32_t c = lexer->lookahead;
  if (c == '#') {
    if (valid_symbols[HEADING_LINE] && scan_heading(lexer)) return true;
    if (valid_symbols[OUTPUT_LINE]) return scan_output_line(lexer, scanner);
    return false;
  }

  if (c == '~' || c == '/') {
    return scan_tilde_or_slash_line(lexer, scanner, valid_symbols);
  }

  if (valid_symbols[OUTPUT_LINE]) return scan_output_line(lexer, scanner);
  return false;
}
