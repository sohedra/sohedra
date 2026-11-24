// `@sohedra/lynx-polyfill/compression` on the background: `CompressionStream` and
// `DecompressionStream` (gzip, deflate, deflate-raw), over the streams fill. Experimental.

import { fillCompression, fillDOMException, fillStreams, globalScope } from "../fills/index.ts";

fillDOMException(globalScope);
fillStreams(globalScope);
fillCompression(globalScope);
