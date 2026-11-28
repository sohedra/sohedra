<!--
  @component
  The Backdrop part of every popup: an overlay beneath the popup. Renders a `<div>` element. A
  component's own Backdrop file hands over its state, its attribute mapping, whether the popup is
  mounted and whether the backdrop lets pointer input through.
-->
<script lang="ts" generics="State extends object">
	import { Part, type PartUserProps, type StateAttributesMapping } from "../kernel/index.js";

	interface Props {
		state: State;
		attrs: StateAttributesMapping<State>;
		/** Whether the popup is mounted: the backdrop is hidden while it isn't. */
		mounted: boolean;
		/** Whether the pointer passes through (a hover-opened popup, so leaving it closes it). */
		passPointer: boolean;
		ref?: HTMLDivElement | null | undefined;
		user: PartUserProps<State>;
	}

	// 1. Props
	let { state, attrs, mounted, passPointer, ref = $bindable(null), user }: Props = $props();

	// 4. Own wiring
	const style = $derived(
		`${passPointer ? "pointer-events: none; " : ""}user-select: none; -webkit-user-select: none`,
	);
</script>

<Part tag="div" bind:ref {state} {attrs} role="presentation" hidden={!mounted} {style} {user} />
