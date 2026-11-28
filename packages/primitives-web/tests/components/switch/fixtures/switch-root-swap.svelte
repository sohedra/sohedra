<!--
  Swaps one Switch.Root for another bound to the same `ref` inside a form, through `{#if}` (the
  first optionally playing an `out:` transition, so its teardown runs after the next mounts) or
  `{#key}`. The demo is one switch and can't be swapped.
-->
<script lang="ts">
	import { fade } from "svelte/transition";

	import SwitchRoot from "#lib/components/switch/switch-root.svelte";

	let { mode = "if", outro = 0 }: { mode?: "if" | "key"; outro?: number } = $props();

	const style = "display: inline-block; width: 16px; height: 16px";

	let which = $state<"a" | "b">("a");
	let ref: HTMLElement | null = $state(null);

	export function swap() {
		which = which === "a" ? "b" : "a";
	}

	export function getRef() {
		return ref;
	}
</script>

<form>
	{#if mode === "if"}
		{#if which === "a"}
			<span out:fade={{ duration: outro }}>
				<SwitchRoot bind:ref name="a" data-testid="a" defaultChecked {style} />
			</span>
		{:else}
			<SwitchRoot bind:ref name="b" data-testid="b" {style} />
		{/if}
	{:else}
		{#key which}
			<SwitchRoot
				bind:ref
				name={which}
				data-testid={which}
				defaultChecked={which === "a"}
				{style}
			/>
		{/key}
	{/if}
	<button type="reset">Reset</button>
</form>
