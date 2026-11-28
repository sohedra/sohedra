<!--
  The `App` of the "transient overlap" case: two detached
  triggers and an outgoing and an incoming Root on the same handle; the incoming one opens by
  trigger id from an effect in the same update that mounts it.
-->
<script lang="ts">
	import type { Component } from "svelte";

	import PopupRunEffect from "./popup-run-effect.svelte";

	// oxlint-disable-next-line typescript/no-explicit-any -- parts of different popups have unrelated props
	type AnyComponent = Component<any>;

	let {
		Root,
		Trigger,
		Portal,
		Positioner,
		Popup,
		triggerProps = {},
		handle,
		phase,
		openOnMount,
	}: {
		Root: AnyComponent;
		Trigger: AnyComponent;
		Portal: AnyComponent;
		Positioner?: AnyComponent;
		Popup: AnyComponent;
		triggerProps?: Record<string, unknown>;
		handle: unknown;
		phase: "outgoing" | "overlap" | "incoming";
		openOnMount: () => void;
	} = $props();
</script>

{#snippet root(key: string)}
	<Root {handle}>
		<Portal>
			{#if Positioner}
				<Positioner>
					<Popup>{key}</Popup>
				</Positioner>
			{:else}
				<Popup>{key}</Popup>
			{/if}
		</Portal>
	</Root>
{/snippet}

{#each [1, 2] as number (number)}
	<Trigger {...triggerProps} {handle} id={`trigger-${number}`} data-testid={`trigger-${number}`}
		>{`Trigger ${number}`}</Trigger
	>
{/each}
{#if phase === "outgoing" || phase === "overlap"}
	{@render root("outgoing")}
{/if}
{#if phase === "overlap" || phase === "incoming"}
	{@render root("incoming")}
	<PopupRunEffect run={openOnMount} />
{/if}
