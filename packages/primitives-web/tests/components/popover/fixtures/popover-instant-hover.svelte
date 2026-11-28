<!--
  Two detached hover triggers with a real position transition on the positioner and a real exit
  transition on the popup, which the unstyled demo has none of. `onRender` sees the popup's state
  each time it changes, through the popup's render snippet.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverHandle, PopoverPopupState } from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let {
		handle,
		switchDuration = 120,
		exitDuration = 250,
		withClose = false,
		onRender,
	}: {
		handle: PopoverHandle<number>;
		switchDuration?: number;
		exitDuration?: number;
		withClose?: boolean;
		onRender: (state: PopoverPopupState) => void;
	} = $props();

	const css = $derived(`
    .positioner {
      transition:
        top ${switchDuration}ms linear,
        left ${switchDuration}ms linear,
        transform ${switchDuration}ms linear;
    }

    .popup {
      opacity: 1;
      transition: opacity ${exitDuration}ms linear;
    }

    .popup[data-ending-style] {
      opacity: 0;
    }

    .positioner[data-instant],
    .popup[data-instant] {
      transition: none;
    }
  `);

	// Returns no attribute value: it only reads the state, so it re-runs when the state changes.
	function record(state: PopoverPopupState): undefined {
		onRender({ ...state });
		return undefined;
	}

	function attachStyle(node: HTMLElement) {
		const style = document.createElement("style");
		style.textContent = css;
		node.append(style);
		return () => style.remove();
	}
</script>

{#snippet popup({ props, state, children }: RenderSnippetProps<PopoverPopupState>)}
	<div {...props} data-record={record(state)}>{@render children?.()}</div>
{/snippet}

<div {@attach attachStyle} style="position: relative; width: 400px; height: 200px">
	<Popover.Trigger
		{handle}
		payload={1}
		openOnHover
		delay={0}
		style="position: absolute; top: 20px; left: 20px">Trigger 1</Popover.Trigger
	>
	<Popover.Trigger
		{handle}
		payload={2}
		openOnHover
		delay={0}
		style="position: absolute; top: 20px; left: 220px">Trigger 2</Popover.Trigger
	>

	<Popover.Root {handle}>
		{#snippet children({ payload })}
			<Popover.Portal>
				<Popover.Positioner data-testid="positioner" class="positioner">
					<Popover.Popup data-testid="popup" class="popup" render={popup}>
						<span data-testid="content">{payload}</span>
						{#if withClose}<Popover.Close>Close</Popover.Close>{/if}
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		{/snippet}
	</Popover.Root>
</div>
