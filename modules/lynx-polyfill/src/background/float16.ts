// `@sohedra/lynx-polyfill/float16` on the background: ES2025's `Math.f16round` and `DataView`'s
// `getFloat16` and `setFloat16`. Not `Float16Array`, whose elements need the engine.

import { fillFloat16 } from "../fills/index.ts";

fillFloat16();
