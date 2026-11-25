<!--
	A generated page's first frame. Imported as `./GeneratedFrame.svelte?first-frame`, this runs in
	the main thread's layer: the page's main-thread copy runs with that layer's Svelte runtime,
	`@sohedra/lynx`, `@sohedra/lynx/environment` and the gesture entries, as a built page's first
	frame does. Its main-thread functions register as it loads.
-->
<script lang="ts">
	import * as root from "@sohedra/lynx";
	import * as env from "@sohedra/lynx/environment";
	import * as experimental from "@sohedra/lynx/experimental";
	import * as gesture from "@sohedra/lynx/gesture";
	import * as functions from "@sohedra/lynx/internal/main-thread-functions";
	import type { Component } from "svelte";

	import * as internals from "../../../src/svelte/runtime/server-internals.ts";
	import { evaluatePage, IDS, INTERNALS } from "../../threads/generated/evaluate.ts";
	import type { CompiledPage, ModuleExports } from "../../threads/generated/evaluate.ts";

	let {
		page,
		props,
		ids,
	}: { page: CompiledPage; props: Record<string, unknown>; ids: ModuleExports } = $props();
	// Boundary: the generated root component takes `data` and `handles`.
	const App = evaluatePage(page, {
		[INTERNALS]: internals,
		[IDS]: ids,
		"@sohedra/lynx": root,
		"@sohedra/lynx/environment": env,
		"@sohedra/lynx/gesture": gesture,
		"@sohedra/lynx/experimental": experimental,
		"@sohedra/lynx/internal/main-thread-functions": functions,
	}) as Component<Record<string, unknown>>;
</script>

<App {...props} />
