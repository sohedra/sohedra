// The shell the polyfill suites run PrimJS with, built in place of PrimJS's own `qjs` (build.ts
// copies it over testing/quickjs/compiler/qjs.cc), so it compiles with the engine's definitions.
// PrimJS's `qjs` runs one script and has no timers; the suites need several scripts in one realm and
// a task loop, as a thread of Lynx has.
//
//   primjs <file>                  runs <file> as a script, then the task loop
//   primjs --parse-module <file>   parses <file> as an ES module, and runs nothing
//
// The realm has `print(...values)`; `load(path)`, which runs a file as a script of the same realm
// and returns its completion value or throws its error; `evalScript(text)`, which does the same
// with text; `read(path)` and `readBytes(path)`, which return a file's text (UTF-8) or its bytes as
// an ArrayBuffer, for a test's fixtures; and `detachArrayBuffer(buffer)`, test262's host hook. The
// task loop: after each script and each task, the engine's jobs (promise reactions) run until none
// is left; then the shell calls the global `hostTurn()`, if the script set one, which runs the next
// due task and returns 0, returns the milliseconds until the next one is due, or returns a negative
// number when none is left.
//
// Exit status: 0, or 1 when the file (or, with --parse-module, its parse) threw; the error is
// printed to standard error.

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#ifdef __cplusplus
extern "C" {
#endif
#include "quickjs/include/cutils.h"
#include "quickjs/include/quickjs-libc.h"
#ifdef __cplusplus
}
#endif
#include "gc/trace-gc.h"
#include "quickjs/include/quickjs-inner.h"

static void free_value(LEPUSContext *ctx, LEPUSValue value) {
  if (!LEPUS_IsGCMode(ctx)) LEPUS_FreeValue(ctx, value);
}

static void free_c_string(LEPUSContext *ctx, const char *text) {
  if (!LEPUS_IsGCMode(ctx)) LEPUS_FreeCString(ctx, text);
}

// Prints the pending exception, with its stack, to standard error.
static void print_exception(LEPUSContext *ctx) {
  LEPUSValue error = LEPUS_GetException(ctx);
  HandleScope scope(ctx, &error, HANDLE_TYPE_LEPUS_VALUE);
  const char *text = LEPUS_ToCString(ctx, error);
  fprintf(stderr, "%s\n", text ? text : "(an error that can't be printed)");
  if (text) free_c_string(ctx, text);
  if (LEPUS_IsError(ctx, error)) {
    LEPUSValue stack = LEPUS_GetPropertyStr(ctx, error, "stack");
    scope.PushHandle(&stack, HANDLE_TYPE_LEPUS_VALUE);
    if (!LEPUS_IsUndefined(stack)) {
      const char *trace = LEPUS_ToCString(ctx, stack);
      if (trace) {
        fprintf(stderr, "%s\n", trace);
        free_c_string(ctx, trace);
      }
    }
    free_value(ctx, stack);
  }
  free_value(ctx, error);
}

// Runs the file at `path` with `flags`; LEPUS_EXCEPTION when it can't be read.
static LEPUSValue eval_file(LEPUSContext *ctx, const char *path, int flags) {
  size_t length;
  uint8_t *source = lepus_load_file(ctx, &length, path);
  if (!source) return LEPUS_ThrowReferenceError(ctx, "could not read %s", path);
  LEPUSValue result = LEPUS_Eval(ctx, (const char *)source, length, path, flags);
  free(source);
  return result;
}

static LEPUSValue js_load(LEPUSContext *ctx, LEPUSValueConst this_value,
                          int argc, LEPUSValueConst *argv) {
  const char *path = LEPUS_ToCString(ctx, argv[0]);
  if (!path) return LEPUS_EXCEPTION;
  LEPUSValue result = eval_file(ctx, path, LEPUS_EVAL_TYPE_GLOBAL);
  free_c_string(ctx, path);
  return result;
}

static LEPUSValue js_eval_script(LEPUSContext *ctx, LEPUSValueConst this_value,
                                 int argc, LEPUSValueConst *argv) {
  size_t length;
  const char *text = LEPUS_ToCStringLen(ctx, &length, argv[0]);
  if (!text) return LEPUS_EXCEPTION;
  LEPUSValue result =
      LEPUS_Eval(ctx, text, length, "<evalScript>", LEPUS_EVAL_TYPE_GLOBAL);
  free_c_string(ctx, text);
  return result;
}

static LEPUSValue js_detach_array_buffer(LEPUSContext *ctx,
                                         LEPUSValueConst this_value, int argc,
                                         LEPUSValueConst *argv) {
  LEPUS_DetachArrayBuffer(ctx, argv[0]);
  return LEPUS_UNDEFINED;
}

// The file at argv[0]'s path, or LEPUS_EXCEPTION; `make` turns its bytes into the value returned.
static LEPUSValue read_file(LEPUSContext *ctx, LEPUSValueConst *argv,
                            LEPUSValue (*make)(LEPUSContext *, const uint8_t *,
                                               size_t)) {
  const char *path = LEPUS_ToCString(ctx, argv[0]);
  if (!path) return LEPUS_EXCEPTION;
  size_t length;
  uint8_t *contents = lepus_load_file(ctx, &length, path);
  LEPUSValue result =
      contents ? make(ctx, contents, length)
               : LEPUS_ThrowReferenceError(ctx, "could not read %s", path);
  free(contents);
  free_c_string(ctx, path);
  return result;
}

static LEPUSValue make_text(LEPUSContext *ctx, const uint8_t *contents,
                            size_t length) {
  return LEPUS_NewStringLen(ctx, (const char *)contents, length);
}

static LEPUSValue make_bytes(LEPUSContext *ctx, const uint8_t *contents,
                             size_t length) {
  return LEPUS_NewArrayBufferCopy(ctx, contents, length);
}

static LEPUSValue js_read(LEPUSContext *ctx, LEPUSValueConst this_value,
                          int argc, LEPUSValueConst *argv) {
  return read_file(ctx, argv, make_text);
}

static LEPUSValue js_read_bytes(LEPUSContext *ctx, LEPUSValueConst this_value,
                                int argc, LEPUSValueConst *argv) {
  return read_file(ctx, argv, make_bytes);
}

// Runs the engine's jobs until none is left; a job that throws is printed.
static void run_jobs(LEPUSContext *ctx) {
  LEPUSContext *job_context;
  for (;;) {
    int status = LEPUS_ExecutePendingJob(LEPUS_GetRuntime(ctx), &job_context);
    if (status == 0) return;
    if (status < 0) print_exception(job_context);
  }
}

// Calls the global `hostTurn` and returns what it returned; a negative number when it isn't
// there or throws.
static double host_turn(LEPUSContext *ctx) {
  LEPUSValue global = LEPUS_GetGlobalObject(ctx);
  HandleScope scope(ctx, &global, HANDLE_TYPE_LEPUS_VALUE);
  LEPUSValue turn = LEPUS_GetPropertyStr(ctx, global, "hostTurn");
  scope.PushHandle(&turn, HANDLE_TYPE_LEPUS_VALUE);
  double wait = -1;
  if (LEPUS_IsFunction(ctx, turn)) {
    LEPUSValue result = LEPUS_Call(ctx, turn, global, 0, NULL);
    scope.PushHandle(&result, HANDLE_TYPE_LEPUS_VALUE);
    if (LEPUS_IsException(result))
      print_exception(ctx);
    else if (LEPUS_ToFloat64(ctx, &wait, result))
      wait = -1;
    free_value(ctx, result);
  }
  free_value(ctx, turn);
  free_value(ctx, global);
  return wait;
}

int main(int argc, char **argv) {
  bool parse_module = argc == 3 && strcmp(argv[1], "--parse-module") == 0;
  if (argc != 2 && !parse_module) {
    fprintf(stderr, "usage: primjs [--parse-module] <file>\n");
    return 2;
  }
  const char *path = argv[argc - 1];

  LEPUSRuntime *runtime = LEPUS_NewRuntime();
  LEPUSContext *ctx = runtime ? LEPUS_NewContext(runtime) : NULL;
  if (!ctx) {
    fprintf(stderr, "primjs: could not make a runtime\n");
    return 2;
  }
  lepus_std_add_helpers(ctx, 0, NULL);

  int status = 0;
  {
    LEPUSValue global = LEPUS_GetGlobalObject(ctx);
    HandleScope scope(ctx, &global, HANDLE_TYPE_LEPUS_VALUE);
    LEPUS_SetPropertyStr(ctx, global, "load",
                         LEPUS_NewCFunction(ctx, js_load, "load", 1));
    LEPUS_SetPropertyStr(ctx, global, "evalScript",
                         LEPUS_NewCFunction(ctx, js_eval_script, "evalScript", 1));
    LEPUS_SetPropertyStr(
        ctx, global, "detachArrayBuffer",
        LEPUS_NewCFunction(ctx, js_detach_array_buffer, "detachArrayBuffer", 1));
    LEPUS_SetPropertyStr(ctx, global, "read",
                         LEPUS_NewCFunction(ctx, js_read, "read", 1));
    LEPUS_SetPropertyStr(ctx, global, "readBytes",
                         LEPUS_NewCFunction(ctx, js_read_bytes, "readBytes", 1));
    free_value(ctx, global);

    int flags = parse_module
                    ? LEPUS_EVAL_TYPE_MODULE | LEPUS_EVAL_FLAG_COMPILE_ONLY
                    : LEPUS_EVAL_TYPE_GLOBAL;
    LEPUSValue result = eval_file(ctx, path, flags);
    scope.PushHandle(&result, HANDLE_TYPE_LEPUS_VALUE);
    if (LEPUS_IsException(result)) {
      print_exception(ctx);
      status = 1;
    }
    free_value(ctx, result);

    if (!parse_module) {
      for (;;) {
        run_jobs(ctx);
        double wait = host_turn(ctx);
        if (wait < 0) break;
        if (wait > 0) usleep((useconds_t)(wait * 1000));
      }
    }
  }

  lepus_std_free_handlers(runtime);
  LEPUS_FreeContext(ctx);
  LEPUS_FreeRuntime(runtime);
  return status;
}
