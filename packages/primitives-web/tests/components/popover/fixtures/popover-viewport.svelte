<!--
  The viewport conformance tree for Popover: a Root, one keyed Trigger per `triggers` entry, and
  Portal > Positioner > Popup > Viewport holding the `content` for the payload. `direction`
  emulates a DirectionProvider; `css` goes into a `<style>` element.
-->
<script lang="ts" module>
	export interface ViewportTestTrigger {
		key?: string;
		id?: string;
		payload?: unknown;
		testId?: string;
		style?: string;
		text: string;
	}

	/**
	 * The content for a payload. `fade` wraps it in a div with a global fade, so a replaced
	 * container stays until its outro ends; `instance` numbers each rendering, so every container
	 * shows a different text.
	 */
	export type ViewportTestContent =
		| "content"
		| "images"
		| "numbered"
		| "text"
		| "fade"
		| "instance";

	let instances = 0;
	function nextInstance() {
		instances += 1;
		return instances;
	}
</script>

<script lang="ts">
	import type { Attachment } from "svelte/attachments";
	import { fade } from "svelte/transition";

	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverPopupProps,
		PopoverPortalProps,
		PopoverPositionerProps,
		PopoverRootProps,
		PopoverViewportProps,
	} from "#lib/components/popover/popover-types.js";
	import { DirectionContext } from "#lib/foundation/kernel/index.js";
	import { DirectionStore } from "#lib/foundation/kernel/kernel-direction.js";

	let {
		open = $bindable(),
		root = {},
		triggers,
		portal = {},
		positioner = {},
		popup = {},
		viewport = {},
		content,
		direction,
		css,
	}: {
		open?: boolean;
		root?: Partial<PopoverRootProps>;
		triggers: ViewportTestTrigger[];
		portal?: Partial<PopoverPortalProps>;
		positioner?: Partial<PopoverPositionerProps>;
		popup?: Partial<PopoverPopupProps>;
		viewport?: Partial<PopoverViewportProps>;
		content: ViewportTestContent;
		direction?: "ltr" | "rtl";
		css?: string;
	} = $props();

	// svelte-ignore state_referenced_locally
	if (direction) {
		DirectionContext.set(new DirectionStore(() => direction ?? "ltr"));
	}

	/** A `<style>` element holding `css`, which the attachment adds and removes. */
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
	<Popover.Root bind:open {...root}>
		{#snippet children({ payload })}
			{#each triggers as trigger, index (trigger.key ?? index)}
				<Popover.Trigger
					id={trigger.id}
					payload={trigger.payload}
					data-testid={trigger.testId}
					style={trigger.style}>{trigger.text}</Popover.Trigger
				>
			{/each}
			<Popover.Portal {...portal}>
				<Popover.Positioner {...positioner}>
					<Popover.Popup {...popup}>
						<Popover.Viewport {...viewport}>
							{#if content === "content"}
								<div data-testid="content">Content</div>
							{:else if content === "images"}
								{#if payload === "first"}
									<img data-testid="payload-image-1" src="about:blank" alt="Preview 1" />
								{/if}
								{#if payload === "second"}
									<img data-testid="payload-image-2" src="about:blank" alt="Preview 2" />
								{/if}
							{:else if content === "numbered"}
								<div data-testid="content">Content {payload as number}</div>
							{:else if content === "instance"}
								Instance {nextInstance()}
							{:else if content === "fade"}
								<div transition:fade|global={{ duration: 100 }}>Content {String(payload)}</div>
							{:else}
								Content {String(payload)}
							{/if}
						</Popover.Viewport>
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		{/snippet}
	</Popover.Root>
</div>
