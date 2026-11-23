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

static bool scan_heading(TSLexer *lexer) {
  if (lexer->get_column(lexer) != 0 || lexer->lookahead != '#') return false;
  uint32_t hashes = 0;
  while (lexer->lookahead == '#' && hashes < 4) {
    adv(lexer);
    hashes++;
  }
  if (hashes < 1 || hashes > 3) return false;
  if (lexer->lookahead != ' ') return false;
  // Consume rest of line and check if it ends with " #", " ##", or " ###" before newline.
  // We need the content; buffer it.
  char buf[4096];
  uint32_t len = 0;
  while (!lexer->eof(lexer) && !is_newline(lexer->lookahead) && len < sizeof(buf) - 1) {
    buf[len++] = (char)lexer->lookahead;
    adv(lexer);
  }
  buf[len] = '\0';
  if (lexer->lookahead == '\r') adv(lexer);
  if (lexer->lookahead == '\n') adv(lexer);

  bool ok = false;
  if (hashes == 1 && len >= 2 && buf[len - 2] == ' ' && buf[len - 1] == '#') ok = true;
  if (hashes == 2 && len >= 3 && buf[len - 3] == ' ' && buf[len - 2] == '#' && buf[len - 1] == '#') ok = true;
  if (hashes == 3 && len >= 4 && buf[len - 4] == ' ' && buf[len - 3] == '#' && buf[len - 2] == '#' && buf[len - 1] == '#') ok = true;
  if (!ok) return false;

  lexer->mark_end(lexer);
  lexer->result_symbol = HEADING_LINE;
  return true;
}

static bool scan_tilde_or_slash_line(TSLexer *lexer, Scanner *scanner, const bool *valid_symbols) {
  // Handles lines starting with ~ or / at col 0.
  if (lexer->get_column(lexer) != 0) return false;
  int32_t first = lexer->lookahead;
  if (first != '~' && first != '/') return false;

  uint32_t col = 0;
  bool saw_gt = false;
  bool all_slash = (first == '/');
  int32_t second = 0;
  int32_t third = 0;

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

  if (all_slash && at_space) all_slash = false;
  while (!lexer->eof(lexer) && !is_newline(lexer->lookahead)) {
    int32_t c = lexer->lookahead;
    if (c != '/') all_slash = false;
    if (col == 1) second = c;
    if (col == 2) third = c;
    adv(lexer);
    col++;
  }
  if (at_space && col == 1) second = ' ';
  if (at_space && col == 2) third = ' ';

  if (lexer->lookahead == '\r') adv(lexer);
  if (lexer->lookahead == '\n') adv(lexer);
  lexer->mark_end(lexer);

  if (first == '/' && col >= 2) {
    bool comment = all_slash || (second == '/' && third == ' ') || (second == '/' && col == 2);
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

static bool scan_space_line(TSLexer *lexer, Scanner *scanner, const bool *valid_symbols) {
  // At col 0, lookahead is space or tab. We need to distinguish continuation
  // prefix (exactly prompt_len spaces, when in interaction and continuation valid)
  // from output. We cannot backtrack, so scan the full line and decide.
  if (lexer->get_column(lexer) != 0) return false;
  if (!(lexer->lookahead == ' ' || lexer->lookahead == '\t')) return false;

  uint32_t spaces = 0;
  while (lexer->lookahead == ' ') {
    adv(lexer);
    spaces++;
  }
  // Tabs are rare in transcripts; treat as output unless exact continuation impossible.
  bool has_tab = (lexer->lookahead == '\t');
  if (has_tab) {
    scan_to_eol(lexer);
    lexer->mark_end(lexer);
    if (valid_symbols[OUTPUT_LINE]) {
      lexer->result_symbol = OUTPUT_LINE;
      scanner->in_interaction = false;
      return true;
    }
    return false;
  }

  bool can_be_continuation = valid_symbols[CONTINUATION_PREFIX] && scanner->in_interaction && scanner->prompt_len > 0 && spaces >= scanner->prompt_len;

  if (can_be_continuation) {
    // We consumed `spaces` chars. Continuation prefix is prompt_len chars.
    // If spaces == prompt_len, this is continuation prefix (possibly followed by code/newline).
    // If spaces > prompt_len, it could still be continuation prefix + code starting with spaces? No, code is the rest of line.
    // Continuation line in transcript: continuation + code. continuation is exact width.
    if (spaces == scanner->prompt_len) {
      lexer->mark_end(lexer);
      lexer->result_symbol = CONTINUATION_PREFIX;
      return true;
    }
    // More spaces than prompt: could be continuation prefix + code that begins with spaces.
    // But we already advanced past prompt_len. We can't mark_end in the past.
    // This is the tricky case. However, transcript continuations are aligned to prompt width;
    // extra spaces are part of code. We need to emit CONTINUATION_PREFIX of prompt_len.
    // Impossible without backtracking. Workaround: only accept continuation when exact count
    // matches and next is not space? No, code can start with space. Better: do not consume extra
    // spaces eagerly - but we already did.
    // Alternative strategy: when in interaction and continuation valid, consume only prompt_len spaces.
  }

  // Not continuation - treat whole line as output.
  scan_to_eol(lexer);
  lexer->mark_end(lexer);
  if (valid_symbols[OUTPUT_LINE]) {
    lexer->result_symbol = OUTPUT_LINE;
    scanner->in_interaction = false;
    return true;
  }
  return false;
}

bool tree_sitter_elvish_transcript_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols) {
  Scanner *scanner = (Scanner *)payload;
  if (lexer->eof(lexer) || lexer->get_column(lexer) != 0) return false;

  int32_t c = lexer->lookahead;

  if (c == '#') {
    // Only treat as heading if it matches transcript heading syntax; else output.
    // scan_heading consumes whole line and returns true only for valid heading.
    if (valid_symbols[HEADING_LINE]) {
      // We need to speculatively scan: scan_heading will consume line. If false, it consumed - bad.
      // So we must implement heading detection without losing ability to emit output.
      // Use scan_heading only when we can afford to consume; on failure, we can't fallback.
      // Instead, detect heading by scanning into buffer and then emitting either heading or output.
    }
  }

  // Dispatch by first char, with careful handling.
  if (c == ' ' || c == '\t') {
    // continuation vs output
    if (valid_symbols[CONTINUATION_PREFIX] && scanner->in_interaction && scanner->prompt_len > 0) {
      // Probe exact prompt_len spaces.
      uint16_t n = 0;
      while (n < scanner->prompt_len && lexer->lookahead == ' ') {
        adv(lexer);
        n++;
      }
      if (n == scanner->prompt_len) {
        lexer->mark_end(lexer);
        lexer->result_symbol = CONTINUATION_PREFIX;
        return true;
      }
      // Not a continuation prefix. We've consumed n spaces - fall through to output by scanning rest of line.
      scan_to_eol(lexer);
      lexer->mark_end(lexer);
      if (valid_symbols[OUTPUT_LINE]) {
        lexer->result_symbol = OUTPUT_LINE;
        scanner->in_interaction = false;
        return true;
      }
      return false;
    }
    if (valid_symbols[OUTPUT_LINE]) return scan_output_line(lexer, scanner);
    return false;
  }

  if (c == '#') {
    // heading or output. Need to scan line once.
    char buf[4096];
    uint32_t len = 0;
    uint32_t hashes = 0;
    while (lexer->lookahead == '#' && hashes < 4) {
      adv(lexer);
      hashes++;
      len++;
    }
    bool heading_candidate = (hashes >= 1 && hashes <= 3 && lexer->lookahead == ' ');
    while (!lexer->eof(lexer) && !is_newline(lexer->lookahead) && len < sizeof(buf) - 1) {
      buf[len] = (char)lexer->lookahead;
      adv(lexer);
      len++;
    }
    buf[len] = '\0';
    if (lexer->lookahead == '\r') adv(lexer);
    if (lexer->lookahead == '\n') adv(lexer);
    lexer->mark_end(lexer);

    bool is_heading = false;
    if (valid_symbols[HEADING_LINE] && heading_candidate) {
      // buf contains the full line including leading hashes
      if (hashes == 1 && len >= 4 && buf[len - 2] == ' ' && buf[len - 1] == '#') is_heading = true;
      if (hashes == 2 && len >= 6 && buf[len - 3] == ' ' && buf[len - 2] == '#' && buf[len - 1] == '#') is_heading = true;
      if (hashes == 3 && len >= 8 && buf[len - 4] == ' ' && buf[len - 3] == '#' && buf[len - 2] == '#' && buf[len - 1] == '#') is_heading = true;
    }
    if (is_heading) {
      lexer->result_symbol = HEADING_LINE;
      scanner->in_interaction = false;
      return true;
    }
    if (valid_symbols[OUTPUT_LINE]) {
      lexer->result_symbol = OUTPUT_LINE;
      scanner->in_interaction = false;
      return true;
    }
    return false;
  }

  if (c == '~' || c == '/') {
    return scan_tilde_or_slash_line(lexer, scanner, valid_symbols);
  }

  if (valid_symbols[OUTPUT_LINE]) return scan_output_line(lexer, scanner);
  return false;
}
