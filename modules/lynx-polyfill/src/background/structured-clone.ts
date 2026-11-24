// `@sohedra/lynx-polyfill/structured-clone` on the background: `structuredClone`, with
// `DOMException`.

import { fillDOMException, fillStructuredClone, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillStructuredClone(globalScope);
