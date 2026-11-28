<!--
  The `Fixture` of the detached-triggers cases: a popup with numbered triggers,
  either inside the Root (`contained`) or outside it with a handle (`detached`). The tested
  popup's parts come in as components.
-->
<script lang="ts">
	import type { Component } from "svelte";

	// oxlint-disable-next-line typescript/no-explicit-any -- parts of different popups have unrelated props
	type AnyComponent = Component<any>;

	let {
		Root,
		Trigger,
		Portal,
		Positioner,
		Popup,
		Viewport,
		Close,
		triggerProps = {},
		mode,
		handle,
		triggerCount = 2,
		rootProps = {},
		rootMounted = true,
		rootFirst = false,
		nesting = 0,
		positionerProps = {},
		withViewport = false,
	}: {
		Root: AnyComponent;
		Trigger: AnyComponent;
		Portal: AnyComponent;
		Positioner?: AnyComponent;
		Popup: AnyComponent;
		Viewport?: AnyComponent;
		Close?: AnyComponent;
		triggerProps?: Record<string, unknown>;
		mode: "contained" | "detached";
		handle?: unknown;
		triggerCount?: number;
		rootProps?: Record<string, unknown>;
		rootMounted?: boolean;
		rootFirst?: boolean;
		nesting?: number;
		positionerProps?: Record<string, unknown>;
		withViewport?: boolean;
	} = $props();

	const detached = $derived(mode === "detached");
	const numbers = $derived(Array.from({ length: triggerCount }, (_, index) => index + 1));
</script>

{#snippet triggerList()}
	{#each numbers as number (number)}
		<Trigger
			{...triggerProps}
			handle={detached ? handle : undefined}
			id={`trigger-${number}`}
			data-testid={`trigger-${number}`}
			payload={number}>{`Trigger ${number}`}</Trigger
		>
	{/each}
{/snippet}

{#snippet triggers(level: number)}
	{#if level > 0}
		<div>{@render triggers(level - 1)}</div>
	{:else}
		{@render triggerList()}
	{/if}
{/snippet}

{#snippet content(payload: unknown)}
	<span data-testid="content">{String(payload)}</span>
{/snippet}

{#snippet popup(payload: unknown)}
	<Popup data-testid="popup">
		{#if withViewport && Viewport}
			<Viewport>{@render content(payload)}</Viewport>
		{:else}
			{@render content(payload)}
		{/if}
		{#if Close}<Close>Close popup</Close>{/if}
	</Popup>
{/snippet}

{#snippet root()}
	{#if rootMounted}
		<Root handle={detached ? handle : undefined} {...rootProps}>
			{#snippet children({ payload }: { payload: unknown })}
				{#if !detached}{@render triggers(nesting)}{/if}
				<span data-testid="root-payload"
					>{payload === undefined ? "No payload" : String(payload)}</span
				>
				<Portal>
					{#if Positioner}
						<Positioner data-testid="positioner" {...positionerProps}>
							{@render popup(payload)}
						</Positioner>
					{:else}
						{@render popup(payload)}
					{/if}
				</Portal>
			{/snippet}
		</Root>
	{/if}
{/snippet}

{#if !detached}
	{@render root()}
{:else if rootFirst}
	{@render root()}
	{@render triggers(nesting)}
{:else}
	{@render triggers(nesting)}
	{@render root()}
{/if}
