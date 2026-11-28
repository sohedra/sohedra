// Sets up Svelte's async mode for the async runs: compiled components turn it on when they load,
// and a test that loads none (a kernel helper's) gets it here.
import "svelte/internal/flags/async";
