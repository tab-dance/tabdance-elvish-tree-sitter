// SPDX-License-Identifier: 0BSD
#include <napi.h>

typedef struct TSLanguage TSLanguage;

extern "C" TSLanguage *tree_sitter_elvish();
extern "C" TSLanguage *tree_sitter_elvish_transcript();

// "tree-sitter", "language" hashed with BLAKE2
const napi_type_tag LANGUAGE_TYPE_TAG = {
    0x8AF2E5212AD58ABF, 0xD5006CAD83ABBA16
};

static Napi::Object MakeLanguage(Napi::Env env, TSLanguage *lang, const char *name) {
  auto language = Napi::External<TSLanguage>::New(env, lang);
  language.TypeTag(&LANGUAGE_TYPE_TAG);
  auto exports = Napi::Object::New(env);
  exports["name"] = Napi::String::New(env, name);
  exports["language"] = language;
  return exports;
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  auto elvish = MakeLanguage(env, tree_sitter_elvish(), "elvish");
  auto transcript = MakeLanguage(env, tree_sitter_elvish_transcript(), "elvish_transcript");

  exports["elvish"] = elvish;
  exports["elvish_transcript"] = transcript;
  // Backward-compatible default export shape for tree-sitter Node bindings:
  // module.exports.name/language for the primary grammar.
  exports["name"] = elvish.Get("name");
  exports["language"] = elvish.Get("language");
  return exports;
}

NODE_API_MODULE(tabdance_elvish_tree_sitter_binding, Init)
