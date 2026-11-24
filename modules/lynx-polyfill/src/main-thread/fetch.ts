// `@sohedra/lynx-polyfill/fetch` on the main thread: `Headers`, `Request` and `Response`, so a
// module both threads load can name them, and a `fetch` that throws: it runs on the background.

import {
	fillAbort,
	fillDOMException,
	fillEvents,
	fillMainThreadFetch,
	globalScope,
} from "../fills/index.ts";

fillDOMException(globalScope);
fillEvents(globalScope);
fillAbort(globalScope);
fillMainThreadFetch(globalScope);
