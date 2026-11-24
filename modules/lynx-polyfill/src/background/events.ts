// `@sohedra/lynx-polyfill/events` on the background: `Event`, `EventTarget`, `CustomEvent`,
// `DOMException`, and the global object as an `EventTarget`: `ErrorEvent`, `PromiseRejectionEvent`,
// `reportError`, `addEventListener`, `onerror`.

import { fillDOMException, fillEvents, fillGlobalEvents, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillEvents(globalScope);
fillGlobalEvents(globalScope);
