// `@sohedra/lynx-polyfill/event-source` on the background: `EventSource`, over the fetch fill.
// Experimental.

import {
	fillAbort,
	fillBlob,
	fillDOMException,
	fillEncodingStreams,
	fillEventSource,
	fillEvents,
	fillFetch,
	fillFormData,
	fillNavigator,
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
fillNavigator(globalScope, readLynx);
fillFetch(globalScope, readLynx);
fillEventSource(globalScope);
