<!--
  The canonical Popover: a Root, its triggers, and Portal > Positioner > Popup, each part with its
  own props object; `variant: "detached"` puts the triggers outside the Root on `handle`. `open` is
  bindable and the way to set it: a spread `rootProps.open` doesn't override the binding.
-->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type {
		PopoverArrowProps,
		PopoverBackdropProps,
		PopoverHandle,
		PopoverPopupProps,
		PopoverPortalProps,
		PopoverPositionerProps,
		PopoverRootProps,
		PopoverTriggerProps,
		PopoverTriggerState,
	} from "#lib/components/popover/popover-types.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let {
		variant = "contained",
		handle: givenHandle,
		open = $bindable(),
		rootProps = {},
		triggerProps = {},
		portalProps = {},
		positionerProps = {},
		popupProps = {},
		backdropProps,
		arrowProps,
		triggers = ["Toggle"],
		triggerAs,
		content = "Content",
		title,
		description,
		close,
		afterTriggers,
		outsideButton,
		portal = true,
		show = true,
	}: {
		variant?: "contained" | "detached";
		handle?: PopoverHandle;
		open?: boolean;
		rootProps?: Partial<PopoverRootProps>;
		triggerProps?: Partial<PopoverTriggerProps> & Record<`data-${string}`, unknown>;
		portalProps?: Partial<PopoverPortalProps>;
		positionerProps?: Partial<PopoverPositionerProps>;
		popupProps?: Partial<PopoverPopupProps> & Record<`data-${string}`, unknown>;
		backdropProps?: Partial<PopoverBackdropProps>;
		arrowProps?: Partial<PopoverArrowProps>;
		triggers?: string[];
		triggerAs?: "span" | "div";
		content?: string;
		title?: string;
		description?: string;
		close?: string;
		afterTriggers?: string;
		outsideButton?: string;
		portal?: boolean;
		show?: boolean;
	} = $props();

	// The handle is made once; a detached popover keeps it across prop changes.
	// svelte-ignore state_referenced_locally
	const handle = givenHandle ?? (variant === "detached" ? Popover.createHandle() : undefined);
	const detached = $derived(variant === "detached");
</script>

{#snippet span({ props, children }: RenderSnippetProps<PopoverTriggerState>)}
	<span {...props}>{@render children?.()}</span>
{/snippet}

{#snippet div({ props, children }: RenderSnippetProps<PopoverTriggerState>)}
	<div {...props}>{@render children?.()}</div>
{/snippet}

{#snippet triggerList()}
	{#each triggers as text, index (text)}
		<Popover.Trigger
			id={`trigger-${index + 1}`}
			handle={detached ? handle : undefined}
			render={triggerAs === "span" ? span : triggerAs === "div" ? div : undefined}
			{...triggerProps}>{text}</Popover.Trigger
		>
	{/each}
	{#if afterTriggers !== undefined}<span>{afterTriggers}</span>{/if}
{/snippet}

{#snippet popover()}
	<Popover.Root bind:open handle={detached ? handle : undefined} {...rootProps}>
		{#if !detached}{@render triggerList()}{/if}
		{#if portal}
			<Popover.Portal {...portalProps}>
				{#if backdropProps}<Popover.Backdrop data-testid="backdrop" {...backdropProps} />{/if}
				<Popover.Positioner data-testid="positioner" {...positionerProps}>
					<Popover.Popup {...popupProps}>
						{#if arrowProps}<Popover.Arrow {...arrowProps} />{/if}
						{#if title !== undefined}<Popover.Title>{title}</Popover.Title>{/if}
						{#if description !== undefined}
							<Popover.Description>{description}</Popover.Description>
						{/if}
						{content}
						{#if close !== undefined}<Popover.Close>{close}</Popover.Close>{/if}
					</Popover.Popup>
				</Popover.Positioner>
			</Popover.Portal>
		{/if}
	</Popover.Root>
{/snippet}

{#if detached}{@render triggerList()}{/if}
{#if show}{@render popover()}{/if}
{#if outsideButton !== undefined}<button type="button">{outsideButton}</button>{/if}
