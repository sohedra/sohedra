<!--
  Two triggers inside a Root whose open state and active trigger the parent owns; `setOpen` and
  `setTriggerId` change them from the test. `onRender` sees the popup's state each time it
  changes.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let { onRender }: { onRender: (state: PopoverPopupState) => void } = $props();

	let open = $state(false);
	let triggerId: string | null = $state(null);

	export function setOpen(next: boolean) {
		open = next;
	}

	export function setTriggerId(next: string) {
		triggerId = next;
	}

	function record(state: PopoverPopupState): undefined {
		onRender({ ...state });
		return undefined;
	}

	const css = `
    .positioner {
      transition:
        top 300ms linear,
        left 300ms linear,
        transform 300ms linear;
    }

    .popup {
      opacity: 1;
      transition: opacity 400ms linear;
    }

    .popup[data-ending-style] {
      opacity: 0;
    }

    .positioner[data-instant],
    .popup[data-instant] {
      transition: none;
    }
  `;

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

<div {@attach attachStyle} style="position: relative; width: 400px; height: 240px">
	<Popover.Root
		{open}
		{triggerId}
		onOpenChange={(nextOpen, details) => {
			if (nextOpen) {
				triggerId = details.trigger?.id ?? null;
			}
			open = nextOpen;
		}}
	>
		<Popover.Trigger id="t1" style="position: absolute; top: 80px; left: 20px"
			>Trigger 1</Popover.Trigger
		>
		<Popover.Trigger id="t2" style="position: absolute; top: 80px; left: 220px"
			>Trigger 2</Popover.Trigger
		>

		<Popover.Portal>
			<Popover.Positioner data-testid="positioner" class="positioner">
				<Popover.Popup data-testid="popup" class="popup" render={popup}>Content</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
</div>
