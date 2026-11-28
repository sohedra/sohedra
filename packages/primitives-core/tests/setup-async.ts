// Sets up Svelte's async mode for `pnpm test:async`: compiled components turn it on when they
// load, and core tests load no component, so it is turned on for them here.
import "svelte/internal/flags/async";
