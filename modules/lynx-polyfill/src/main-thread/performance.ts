// `@sohedra/lynx-polyfill/performance` on the main thread: `performance` and `Performance`, with
// User Timing's marks and measures.

import {
	fillDOMException,
	fillPerformance,
	fillStructuredClone,
	globalScope,
} from "../fills/index.ts";

fillDOMException(globalScope);
fillStructuredClone(globalScope);
fillPerformance(globalScope);
