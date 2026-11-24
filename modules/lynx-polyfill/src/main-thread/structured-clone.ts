// `@sohedra/lynx-polyfill/structured-clone` on the main thread: `structuredClone`, with
// `DOMException`.

import { fillDOMException, fillStructuredClone, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillStructuredClone(globalScope);
