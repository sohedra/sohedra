import analytics, { CONFIG, track } from "./analytics.ts";
import App from "./App.svelte";
import legacy from "./legacy.cjs";
import { store } from "./store.svelte.ts";

// Kept on a global so that the bundler keeps what the page uses. The main thread's copy of each
// background-only module is a stub, which only throws when it is used.
(globalThis as Record<string, unknown>)["page"] = [App, analytics, CONFIG, track, legacy, store];
