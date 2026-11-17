// The module every compiled component imports as its custom renderer
// (`@sohedra/lynx/internal/renderer`): Svelte reads its default export.

import { createRenderer } from "svelte/renderer";

import { pageRenderer } from "./page-renderer.ts";
import type { LynxRenderer } from "./renderer.ts";

const renderer: LynxRenderer = createRenderer(pageRenderer);

export default renderer;
