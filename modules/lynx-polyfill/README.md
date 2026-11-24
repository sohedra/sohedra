# @sohedra/lynx-polyfill

The web's standard APIs and the language through ES2025, on both of [Lynx](https://lynxjs.org)'s
threads. Lynx's engine, PrimJS, and lynx-core lack much of what web code expects: `URL` that parses,
`TextEncoder`, streams, a standard `fetch`, `AbortSignal.timeout`, `Array.prototype.at`. This
package fills them, so the code you write and the libraries you install run as they do in a browser.
It imports no framework. Its imports resolve by thread, so the build must resolve the main thread's
imports with the `worker` export condition: Sohedra's build does; an app built otherwise
(ReactLynx's included, which is untested) must add it, or its main thread loads the background's
fills.

Each fill installs only where the thread lacks the global or gets it wrong, and never replaces one
that works: on an iOS app whose background thread runs on JavaScriptCore, most fills step aside.

## Use

Import the package in the first line of your app's entry, before any module that uses what it fills:

```ts
import "@sohedra/lynx-polyfill";
```

That installs the baseline on each thread. To install less, import only the fills you use; each
import installs its fill and what that fill sits on:

```ts
import "@sohedra/lynx-polyfill/url";
import "@sohedra/lynx-polyfill/fetch";
```

Each import resolves by thread, through the `worker` export condition on the main thread: there it
installs that thread's part (the main thread gets no streams and no working `fetch`, which run on
the background). An import of a background-only fill does nothing on the main thread, so a module
both threads load can name it.

When your code reads a global that no import put there, Sohedra's report names the import that fills
it: `The global \`URL\` is not defined: … Import "@sohedra/lynx-polyfill/url" …`.

## What each import fills

| Import              | Fills                                                                                                                                                                                                                                                                                                                              | Threads                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `.` (the baseline)  | Everything below except the experimental fills and the heavy language fills, and `queueMicrotask`, `self`, `navigator` (`userAgent`: `Lynx/4.2 (Android)`), the timers on the global object and `console.trace`/`assert`                                                                                                           | both                                                                                                                                      |
| `/language`         | The language through ES2025 that PrimJS lacks or gets wrong: `at`, `findLast`, `toSorted` and the rest, `Object.hasOwn`, `Object.groupBy`, `replaceAll`, `isWellFormed`, `Error` `cause`, `RegExp.escape`, the `Promise` statics, and fixes to `Object.getOwnPropertyDescriptor`, `Reflect.apply`, `matchAll` and `BigInt.asUintN` | both; on the background also lynx-core's `Promise`                                                                                        |
| `/events`           | `Event`, `EventTarget`, `CustomEvent`, `DOMException`, and the global object as an `EventTarget`: `ErrorEvent`, `PromiseRejectionEvent`, `reportError`, `addEventListener`, `onerror`                                                                                                                                              | both                                                                                                                                      |
| `/abort`            | `AbortController`, `AbortSignal` with `timeout`, `any`, `abort`, `throwIfAborted`                                                                                                                                                                                                                                                  | both                                                                                                                                      |
| `/base64`           | `atob`, `btoa`                                                                                                                                                                                                                                                                                                                     | both                                                                                                                                      |
| `/structured-clone` | `structuredClone`, with `DataCloneError`                                                                                                                                                                                                                                                                                           | both                                                                                                                                      |
| `/encoding`         | `TextEncoder`, `TextDecoder` (UTF-8)                                                                                                                                                                                                                                                                                               | both                                                                                                                                      |
| `/url`              | `URL`, `URLSearchParams`                                                                                                                                                                                                                                                                                                           | both                                                                                                                                      |
| `/performance`      | `performance`, `Performance`, User Timing's marks and measures                                                                                                                                                                                                                                                                     | both                                                                                                                                      |
| `/streams`          | `ReadableStream` (with BYOB readers, `from` and async iteration), `WritableStream`, `TransformStream`, their readers, controllers and queuing strategies, `TextEncoderStream`, `TextDecoderStream`                                                                                                                                 | background                                                                                                                                |
| `/fetch`            | `fetch`, `Headers`, `Request`, `Response`, `Blob`, `File`, `FormData`                                                                                                                                                                                                                                                              | background; the main thread gets `Headers`, `Request`, `Response` (with `TextEncoder`, `TextDecoder` and `URL`) and a `fetch` that throws |
| `/event-source`     | `EventSource` (experimental), over `fetch`                                                                                                                                                                                                                                                                                         | background                                                                                                                                |
| `/compression`      | `CompressionStream`, `DecompressionStream`: gzip, deflate, deflate-raw (experimental)                                                                                                                                                                                                                                              | background                                                                                                                                |
| `/url-pattern`      | `URLPattern` (experimental)                                                                                                                                                                                                                                                                                                        | both                                                                                                                                      |
| `/messaging`        | `MessageChannel`, `MessagePort`, `MessageEvent`, within one thread (experimental)                                                                                                                                                                                                                                                  | both                                                                                                                                      |
| `/iterator-helpers` | ES2025's `Iterator` and its helpers (`map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `toArray`…)                                                                                                                                                                                                                             | both                                                                                                                                      |
| `/set-methods`      | ES2025's `Set` methods (`union`, `intersection`, `difference`…)                                                                                                                                                                                                                                                                    | both                                                                                                                                      |
| `/float16`          | `Math.f16round`, `DataView`'s `getFloat16` and `setFloat16`                                                                                                                                                                                                                                                                        | both                                                                                                                                      |
| `/normalize`        | `String.prototype.normalize`                                                                                                                                                                                                                                                                                                       | both                                                                                                                                      |

The heavy language fills (`/iterator-helpers`, `/set-methods`, `/float16`, `/normalize`) are not in
the baseline for their size: import them when your code or a library uses them.

The baseline costs about 70 KB gzip (228 KB minified) on the background and about 52 KB gzip (152 KB
minified) on the main thread. Each import's size, per thread, is a budget in the package's tests
(`tests/package/entries.test.ts`).

## How a fill installs

- **Only where needed.** A fill checks the thread's global, or its behavior, before it installs: a
  missing global, or one that fails a check of what the standard says (PrimJS's `matchAll`,
  lynx-core's `URL` and `ReadableStream`), gets the fill; one that works stays.
- **Writable and configurable,** as WinterTC's global scope allows: your code can put its own in
  place.
- **Lazy where it can be.** Most globals are getters that load their fill the first time they are
  read. What other code needs before it runs (`queueMicrotask`, `DOMException`, the events, the
  language's methods) installs at once.

## Errors

What a fill catches (a listener's throw, a callback's, `reportError`) is reported as the web reports
an exception: an `error` event on the global object, an `ErrorEvent` with the thrown value as its
`error`. Call `preventDefault()` on it to handle it yourself; otherwise the package reports it into
Lynx with `lynx.reportError`, which LogBox shows.

A framework hears these errors the same way: Sohedra's binding listens for `error` on the global
object and sends each to your page's `onError`. The package imports no framework.

There are no `onunhandledrejection` and `onrejectionhandled` handlers: neither of Lynx's threads
tells JavaScript about a rejection nobody handled (lynx-core sends the background's to the host
app), and WinterTC says a runtime that can't fire those events must not offer them.

## Experimental fills

`EventSource`, `CompressionStream` and `DecompressionStream`, `URLPattern`, and the `MessageChannel`
family are experimental: they may change in any minor release, and their web platform tests do not
all pass on PrimJS yet. In a development build, the first read of one of their globals warns once,
into LogBox. Each becomes stable, with no change to your code, once its tests pass on PrimJS and on
an Android and an iOS device.

## Streaming a response's body

By default, Lynx reads a response's whole body before `fetch`'s `response.body` gives its first
chunk. For a body that arrives over time (a large download you show progress for, an AI model's
tokens, `EventSource`'s events, which arrive only as they come), turn on the page config's
`enableFetchAPIStandardStreaming`. In Sohedra's build, that is the plugin's `pageConfig` option:

```ts
pluginSvelteLynx({ pageConfig: { enableFetchAPIStandardStreaming: true } });
```

With it on, Lynx hands each chunk to `response.body` as it arrives. It is off by default because it
changes lynx-core's own `fetch` too: without this package's `/fetch`, a streamed response's
`clone()` throws. This package's `fetch` reads the body either way.

## What no fill gives

| Global or feature                                                                         | Instead                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `crypto`                                                                                  | For hashes, a library in plain JavaScript such as `@noble/hashes`. Lynx has no secure source of random numbers in JavaScript: make keys and tokens on a server or in a native module. |
| `Intl`, and the locale methods (`toLocaleString`, `toLocaleDateString`, `localeCompare`…) | A library in plain JavaScript such as date-fns or dayjs. The locale methods give fixed English output.                                                                                |
| `WebAssembly`                                                                             | Run that code on a server, or port it to JavaScript or a native module.                                                                                                               |
| `WebSocket`                                                                               | A native module of the host app that gives a socket, or a server that sends events over `fetch` (`/event-source`).                                                                    |
| `matchMedia`                                                                              | The global `SystemInfo` (`pixelWidth`, `pixelHeight`, `pixelRatio`).                                                                                                                  |
| `localStorage`                                                                            | A native storage module of the host app.                                                                                                                                              |
| `fetch` on the main thread                                                                | Call it on the background: in an effect or an event handler, or hand the call over from a main-thread function.                                                                       |
| `Float16Array`                                                                            | A typed array's elements need the engine: use `Math.f16round` with a `Uint16Array` and `DataView`'s float16 methods.                                                                  |
| Resizable `ArrayBuffer`, `transfer` and `detached`, `Atomics`, symbols as `WeakMap` keys  | Not fillable in JavaScript.                                                                                                                                                           |
| RegExp's `v` and `d` flags, modifiers (`(?i:…)`) and duplicate named groups               | PrimJS refuses them; Sohedra's build stops at each literal with what to write instead, and a development build warns at each `RegExp` call that makes one.                            |

## Known limits

- **`fetch`**: redirects are the native module's, so `redirected` is always `false` and `redirect`
  does nothing; CORS, credentials, the cache and `keepalive` mean nothing outside a browser; an
  upload is read whole before it is sent. A response's body arrives whole unless the page streams it
  (see [Streaming a response's body](#streaming-a-responses-body)).
- **Events**: an event's `target` on the global object is the global object's own target, and
  `ErrorEvent` has no `filename`, `lineno` or `colno`. An event's `timeStamp` is the epoch's.
- **`performance`**: the clock is `Date.now()`'s, in whole milliseconds, never going back; there is
  no `PerformanceObserver`.
- **`structuredClone`**: no `transfer`. A value nested deeper than the engine's stack fails as a
  `DataCloneError`.
- **`TextEncoder` and `TextDecoder`**: UTF-8 only; another label is a `RangeError`.
- **`FormData`**: there is no form element to read from.
- **`EventSource`**: no relative URL, as a thread has no document to resolve it against.
- **`MessageChannel`**: within one thread; across Lynx's threads, use your framework's calls.
- **`DecompressionStream`**: untrusted data is held to 64 MiB per stream (its output and a gzip
  header's bytes), past which the stream errors with a `RangeError`; a gzip header longer than 64
  KiB is refused with a `TypeError`.
- **`URLPattern`**: a pattern you write with `\p{…}` fails at run time, as PrimJS has no Unicode
  property tables.
- **`String.prototype.normalize`**: Unicode's data as of 8.0.
- **`self` and `navigator`** on the background are parameters of Lynx's script wrapper, bound to
  `undefined`; Sohedra's build renames them so your code reads these. A build that doesn't reads
  them as `globalThis.self` and `globalThis.navigator`.
- **`fetch` on the background** is a parameter of Lynx's script wrapper too, bound to lynx-core's;
  Sohedra's build points your code's `fetch` at this one.
- **Unicode property escapes** (`\p{…}`) in a regular expression built at run time
  (`new RegExp("\\p{L}", "u")`) fail: PrimJS has no Unicode property tables. Sohedra's build lowers
  the ones written in your code.
- **lynx-core's `Promise`** on the background has no `Symbol.species`: `/language` gives it `any`,
  `allSettled`, `withResolvers`, `try` and a working `finally` without it, and a subclass's `then`
  still returns lynx-core's `Promise`.
- **PrimJS's `JSON`**: `JSON.parse` cuts a string at an escaped `\u0000` and refuses an escaped lone
  surrogate (`"\ud800"`); `JSON.stringify` gives `"0"` for a number of magnitude `1e-15` or less,
  doesn't throw on a `BigInt`, and goes through `Array.prototype`'s setters as it works, so a page
  that sets one changes its output. No fill replaces `JSON` yet.
- **PrimJS's `Object.assign`** copies a property that a getter on the source made non-enumerable
  during the same copy, which the standard skips: after
  `s = Object.defineProperty({}, "a", { enumerable: true, get() { Object.defineProperty(this, "b", { value: 3, enumerable: false }); } }); s.b = 2;`,
  `Object.assign({}, s).b` is `3`, not `undefined`. Onto an array, from a `Proxy` whose `ownKeys`
  lists keys its target lacks, it copies nothing: `[]` where the standard gives `[, 9]`. It stays
  for speed: core-js's is 5 to 7.5 times slower on PrimJS.
- **Pages of a `LynxGroup`** share one background realm: the first page's fills serve them all.

## Tested

Each fill has unit tests in Node; the web platform tests (WPT) and test262 run on the PrimJS of the
oldest and the newest Lynx this package supports, on both threads, built from source with the
phone's flags (`pnpm -F @sohedra/lynx-polyfill test:primjs`). Every import runs on JavaScriptCore
too, which must keep every built-in it has.

## License

Apache-2.0. The npm packages it bundles keep their own licenses; `NOTICE` lists them.
