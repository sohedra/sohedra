import LazyHost from "./LazyHost.svelte";

// Kept on a global so that the bundler keeps what the page uses.
(globalThis as Record<string, unknown>)["page"] = LazyHost;
