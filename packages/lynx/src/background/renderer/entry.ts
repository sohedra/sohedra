// The module every compiled component imports as its custom renderer
// (`@sohedra/lynx/internal/renderer`): Svelte reads its default export. A component with a
// `<list-item defer>` also imports the state of its deferred rows from here.

import { createRenderer } from "svelte/renderer";
import type { Renderer } from "svelte/renderer";

import { pageRenderer } from "./page-renderer.ts";
import type { LynxNodes } from "./renderer.ts";

export { deferredRow } from "./rows.ts";

const renderer: Renderer<LynxNodes> = createRenderer<LynxNodes>(pageRenderer);

export default renderer;
