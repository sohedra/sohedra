import type { Environment } from "vitest/runtime";

/**
 * Node globals (no DOM) with modules transformed for the client, so core stores run their
 * `$effect`s headless. Vitest's `node` environment transforms for the server.
 */
export default {
	name: "node-client",
	viteEnvironment: "client",
	setup() {
		return { teardown() {} };
	},
} satisfies Environment;
