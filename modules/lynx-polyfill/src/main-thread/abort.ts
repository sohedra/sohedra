// `@sohedra/lynx-polyfill/abort` on the main thread: `AbortController` and `AbortSignal` (`timeout`,
// `any`, `abort`), with the events and `DOMException` they sit on.

import { fillAbort, fillDOMException, fillEvents, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillEvents(globalScope);
fillAbort(globalScope);
