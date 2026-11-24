// `@sohedra/lynx-polyfill/iterator-helpers` on the main thread: ES2025's iterator helpers: the
// global `Iterator` and its `map`, `filter`, `take`, `drop`, `flatMap`, `reduce`, `toArray` and the
// rest.

import { fillIteratorHelpers } from "../fills/index.ts";

fillIteratorHelpers();
