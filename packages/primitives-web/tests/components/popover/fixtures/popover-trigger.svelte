<!--
  The Popover.Trigger test trees: a Popover.Root (props given) with one trigger (props given,
  rendered as a `<span>` or `<div>` with `renderAs`) and, unless `withPopup` is false, Portal >
  Positioner > Popup holding `content`. `otherButton` adds a button after the popover, in a wrapping
  `<div>`.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverRootProps,
		PopoverTriggerProps,
		PopoverTriggerState,
	} from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let {
		rootProps = {},
		triggerProps = {},
		triggerText,
		renderAs,
		withPopup = true,
		content,
		otherButton = false,
	}: {
		rootProps?: Partial<PopoverRootProps>;
		triggerProps?: Partial<PopoverTriggerProps>;
		triggerText?: string;
		renderAs?: "span" | "div";
		withPopup?: boolean;
		content?: string;
		otherButton?: boolean;
	} = $props();
</script>

{#snippet span({ props, children }: RenderSnippetProps<PopoverTriggerState>)}
	<span {...props}>{@render children?.()}</span>
{/snippet}

{#snippet div({ props, children }: RenderSnippetProps<PopoverTriggerState>)}
	<div {...props}>{@render children?.()}</div>
{/snippet}

<div>
	<Popover.Root {...rootProps}>
		<Popover.Trigger
			render={renderAs === "span" ? span : renderAs === "div" ? div : undefined}
			{...triggerProps}>{triggerText}</Popover.Trigger
		>
		{#if withPopup}
			<Popover.Portal>
				<Popover.Positioner>
					<Popover.Popup>{content}</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		{/if}
	</Popover.Root>
	{#if otherButton}<button data-testid="other-button">Other button</button>{/if}
</div>
