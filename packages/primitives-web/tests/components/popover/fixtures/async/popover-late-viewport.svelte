<!--
  A Viewport popover whose content awaits `load(payload)` without a `<svelte:boundary>`: switching
  triggers re-creates the content, which stays pending until that payload's promise resolves. One
  trigger per entry of `payloads`, each with that payload.
-->
<script lang="ts">
	import type { Attachment } from "svelte/attachments";

	import { Popover } from "#lib/components/popover/index.js";

	let {
		payloads,
		load,
		css,
	}: {
		payloads: number[];
		load: (payload: number | undefined) => Promise<string>;
		css?: string;
	} = $props();

	/** `css` in a `<style>` element the attachment adds and removes. */
	function styleSheet(text: string | undefined): Attachment<HTMLElement> {
		return (node) => {
			if (!text) {
				return;
			}
			const style = document.createElement("style");
			style.textContent = text;
			node.prepend(style);
			return () => style.remove();
		};
	}
</script>

<div {@attach styleSheet(css)}>
	<Popover.Root>
		{#snippet children({ payload })}
			{#each payloads as value (value)}
				<Popover.Trigger data-testid="trigger{value}" payload={value}
					>Trigger {value}</Popover.Trigger
				>
			{/each}
			<Popover.Portal>
				<Popover.Positioner>
					<Popover.Popup data-testid="popup">
						<Popover.Viewport data-testid="viewport">
							<div>{await load(payload as number | undefined)}</div>
						</Popover.Viewport>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		{/snippet}
	</Popover.Root>
</div>
