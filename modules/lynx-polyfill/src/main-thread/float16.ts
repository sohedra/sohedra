// `@sohedra/lynx-polyfill/float16` on the main thread: ES2025's `Float16Array`, `Math.f16round` and
// `DataView`'s `getFloat16` and `setFloat16`.

import { fillFloat16 } from "../fills/index.ts";

fillFloat16();
