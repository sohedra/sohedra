// `@sohedra/lynx-polyfill/url-pattern` on the background: `URLPattern`, over the URL fill.
// Experimental.

import { fillUrl, fillUrlPattern, globalScope } from "../fills/index.ts";

fillUrl(globalScope);
fillUrlPattern(globalScope);
