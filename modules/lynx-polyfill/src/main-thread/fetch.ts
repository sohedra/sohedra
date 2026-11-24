// `@sohedra/lynx-polyfill/fetch` on the main thread: `Headers`, `Request` and `Response`, so a
// module both threads load can name them, with the encoding and `URL` their bodies and URLs sit
// on, and a `fetch` that throws: it runs on the background.

import {
	fillAbort,
	fillDOMException,
	fillEvents,
	fillMainThreadFetch,
	fillTextEncoding,
	fillUrl,
	globalScope,
} from "../fills/index.ts";

fillDOMException(globalScope);
fillEvents(globalScope);
fillAbort(globalScope);
fillTextEncoding(globalScope);
fillUrl(globalScope);
fillMainThreadFetch(globalScope);
