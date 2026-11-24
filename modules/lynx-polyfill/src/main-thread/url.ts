// `@sohedra/lynx-polyfill/url` on the main thread: `URL` and `URLSearchParams`.

import { fillUrl, globalScope } from "../fills/index.ts";

fillUrl(globalScope);
