<!--
	A generated page's first frame. Imported as `./GeneratedFrame.svelte?first-frame`, this runs in
	the main thread's layer: the page's main-thread copy runs with that layer's Svelte runtime and
	`@sohedra/lynx/env`, as a built page's first frame does.
-->
<script lang="ts">
	import * as env from "@sohedra/lynx/env";
	import type { Component } from "svelte";

	import * as internals from "../../../src/svelte/runtime/server-internals.ts";
	import { evaluatePage, INTERNALS } from "../../threads/generated/evaluate.ts";
	import type { CompiledPage } from "../../threads/generated/evaluate.ts";

	let { page, props }: { page: CompiledPage; props: Record<string, unknown> } = $props();
	// Boundary: the generated root component takes `data` and `handles`.
	const App = evaluatePage(page, {
		[INTERNALS]: internals,
		"@sohedra/lynx/env": env,
	}) as Component<Record<string, unknown>>;
</script>

<App {...props} />
