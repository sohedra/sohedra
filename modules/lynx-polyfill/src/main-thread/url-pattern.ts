// `@sohedra/lynx-polyfill/url-pattern` on the main thread: `URLPattern`, over the URL fill.
// Experimental.

import { fillUrl, fillUrlPattern, globalScope } from "../fills/index.ts";

fillUrl(globalScope);
fillUrlPattern(globalScope);
