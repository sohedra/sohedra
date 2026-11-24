// `@sohedra/lynx-polyfill/encoding` on the main thread: `TextEncoder` and `TextDecoder` (UTF-8).

import { fillTextEncoding, globalScope } from "../fills/index.ts";

fillTextEncoding(globalScope);
