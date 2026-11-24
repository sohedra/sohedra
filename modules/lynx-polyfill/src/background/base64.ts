// `@sohedra/lynx-polyfill/base64` on the background: `atob` and `btoa`, with `DOMException`.

import { fillAtob, fillDOMException, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillAtob(globalScope);
