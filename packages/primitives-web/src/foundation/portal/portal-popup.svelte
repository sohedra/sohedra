<!--
  The Portal part of every popup that takes focus: it moves the popup's subtree into another
  container (`<body>` by default) and manages focus across the move. Renders a `<div>` element,
  with the outside focus guards around it while a non-modal popup inside is open.

  A component's own Portal file hands over whether the portal is mounted, its generated id, the
  presses that count as inside, its state and the user's props.
-->
<script lang="ts" generics="State extends object">
	import type { Attachment } from "svelte/attachments";

	import { Part, type PartUserProps } from "../kernel/index.js";
	import {
		ownerVisuallyHidden,
		type PortalContainer,
		useFocusPortal,
	} from "./portal-focus.svelte.js";

	interface Props {
		state: State;
		/** Whether the portal renders: the popup is mounted, or the portal keeps it mounted. */
		mounted: boolean;
		/** The `container` prop: where the portal element goes. */
		container: PortalContainer;
		/** The portal element's generated id. */
		id: string;
		/** Marks the presses in the portal that are inside the popups the popup is nested in. */
		inside: Attachment<HTMLElement>;
		ref?: HTMLDivElement | null | undefined;
		user: PartUserProps<State>;
	}

	// 1. Props
	let { state, mounted, container, id, inside, ref = $bindable(null), user }: Props = $props();

	// 3. Shared behaviours
	// A popup that takes focus has its portal manage focus across the move.
	const portal = useFocusPortal(() => ({ container }));

	// 4. Own wiring
	// The id the element renders with: the user's when given.
	const ownedId = $derived("id" in user ? (user.id as string | undefined) : id);
</script>

<!--
  The portal element must stay the only node of its block, because the portal moves that node
  into another container: the `{#key}` re-creates it for a new container, and nothing else
  renders beside it.
-->
{#if mounted}
	{#if portal.shouldRenderGuards}<span {...portal.beforeOutsideGuardProps}></span><span
			aria-owns={ownedId}
			style={ownerVisuallyHidden}
		></span>{/if}
	{#if portal.container}
		{#key portal.container}
			<Part tag="div" bind:ref {state} {id} {...portal.nodeProps} {@attach inside} {user} />
		{/key}
	{/if}
	{#if portal.shouldRenderGuards}<span {...portal.afterOutsideGuardProps}></span>{/if}
{/if}
