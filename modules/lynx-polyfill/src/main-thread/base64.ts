// `@sohedra/lynx-polyfill/base64` on the main thread: `atob` and `btoa`, with `DOMException`.

import { fillAtob, fillDOMException, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillAtob(globalScope);
