// Sets up the environment core tests run in: Node's globals (no DOM), with modules transformed for
// the client, so core stores run their `$effect`s headless.
import type { Environment } from "vitest/runtime";

/** Vitest's `node` environment, but transforming for the client: `node` transforms for the server. */
export default {
	name: "node-client",
	viteEnvironment: "client",
	setup() {
		return { teardown() {} };
	},
} satisfies Environment;
