// `pnpm test:async`: compiled components turn on Svelte's async mode when they load; core tests
// load no component, so turn it on for them too.
import "svelte/internal/flags/async";
