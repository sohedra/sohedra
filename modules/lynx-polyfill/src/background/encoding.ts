// `@sohedra/lynx-polyfill/encoding` on the background: `TextEncoder` and `TextDecoder` (UTF-8).

import { fillTextEncoding, globalScope } from "../fills/index.ts";

fillTextEncoding(globalScope);
