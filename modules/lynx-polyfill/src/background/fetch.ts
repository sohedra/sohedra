// `@sohedra/lynx-polyfill/fetch` on the background: `fetch`, `Headers`, `Request` and `Response`,
// with `Blob`, `File`, `FormData` and what they sit on (streams, `AbortController`, encoding,
// `URL`).

import {
	fillAbort,
	fillBlob,
	fillDOMException,
	fillEncodingStreams,
	fillEvents,
	fillFetch,
	fillFormData,
	fillStreams,
	fillTextEncoding,
	fillUrl,
	globalScope,
	readLynx,
} from "../fills/index.ts";

fillDOMException(globalScope);
fillEvents(globalScope);
fillAbort(globalScope);
fillTextEncoding(globalScope);
fillUrl(globalScope);
fillStreams(globalScope);
fillEncodingStreams(globalScope);
fillBlob(globalScope);
fillFormData(globalScope);
fillFetch(globalScope, readLynx);
