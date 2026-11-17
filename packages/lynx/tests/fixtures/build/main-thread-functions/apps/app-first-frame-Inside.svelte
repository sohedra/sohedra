<script module>
	// A top-level side effect: it runs on the main thread too, as on Svelte's server.
	globalThis.insideModuleMarker = "inside-module-marker";
</script>

<script lang="ts">
	import { insideCount } from "./inside-effect.ts";
	import { insideLabel } from "./inside-pure.ts";

	function paint(event: {
		currentTarget: { setStyleProperty(name: string, value: string): void };
	}) {
		"main thread";
		event.currentTarget.setStyleProperty("color", "inside-main-thread-marker");
	}
</script>

<view main-thread:ontap={paint}
	><text>inside-template-marker {insideLabel} {insideCount}</text></view
>
{#await import("./InsideLazy.svelte") then lazy}<lazy.default />{/await}
