<!--
  Two hover triggers in a Root whose parent accepts a close but commits `open = false` only
  `commitDelay` ms later, refusing the close with `cancel()` until then, which the demo can't
  express. `onRender` sees each state of the popup.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { PopoverPopupState } from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let {
		onRender,
		onOpenTrigger,
		switchDuration = 200,
		commitDelay = 400,
	}: {
		onRender: (state: PopoverPopupState, closeRequested: boolean) => void;
		onOpenTrigger: (id: string | undefined) => void;
		switchDuration?: number;
		commitDelay?: number;
	} = $props();

	let open = $state(false);
	let activeTrigger: string | null = $state(null);
	let closeRequested = false;

	function record(state: PopoverPopupState): undefined {
		onRender({ ...state }, closeRequested);
		return undefined;
	}

	const css = $derived(`
    .positioner {
      transition:
        top ${switchDuration}ms linear,
        left ${switchDuration}ms linear,
        transform ${switchDuration}ms linear;
    }

    .popup {
      opacity: 1;
      transition: opacity 250ms linear;
    }

    .popup[data-ending-style] {
      opacity: 0;
    }

    .positioner[data-instant],
    .popup[data-instant] {
      transition: none;
    }
  `);

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
	<Popover.Root
		{open}
		triggerId={activeTrigger}
		onOpenChange={(nextOpen, details) => {
			if (nextOpen) {
				onOpenTrigger(details.trigger?.id);
				activeTrigger = details.trigger?.id ?? null;
				open = true;
				return;
			}

			details.cancel();
			closeRequested = true;
			setTimeout(() => (open = false), commitDelay);
		}}
	>
		<Popover.Trigger
			payload={1}
			id="trigger-1"
			openOnHover
			delay={0}
			style="position: absolute; top: 20px; left: 20px">Trigger 1</Popover.Trigger
		>
		<Popover.Trigger
			payload={2}
			id="trigger-2"
			openOnHover
			delay={0}
			style="position: absolute; top: 20px; left: 220px">Trigger 2</Popover.Trigger
		>

		<Popover.Portal>
			<Popover.Positioner data-testid="positioner" class="positioner">
				<Popover.Popup data-testid="popup" class="popup" render={popup}>Content</Popover.Popup>
			</Popover.Positioner>
		</Popover.Portal>
	</Popover.Root>
</div>
