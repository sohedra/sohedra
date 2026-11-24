// `@sohedra/lynx-polyfill/messaging` on the background: `MessageChannel`, `MessagePort` and
// `MessageEvent`, within one thread. Experimental.

import {
	fillDOMException,
	fillEvents,
	fillMessaging,
	fillStructuredClone,
	globalScope,
} from "../fills/index.ts";

fillDOMException(globalScope);
fillEvents(globalScope);
fillStructuredClone(globalScope);
fillMessaging(globalScope);
