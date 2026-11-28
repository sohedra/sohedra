<!--
  @component
  The movable part of the switch that indicates whether the switch is on or off. Renders a
  `<span>`.
-->
<script lang="ts">
	import { Part } from "../../foundation/kernel/index.js";
	import { switchStateMapping } from "./switch-attributes.js";
	import { SwitchRootContext } from "./switch-context.js";
	import type { SwitchThumbProps } from "./switch-types.js";

	// 1. Props
	let { ref = $bindable(null), ...rest }: SwitchThumbProps = $props();

	// 2. Store and context
	const sw = SwitchRootContext.get("Switch.Thumb");
</script>

<Part tag="span" bind:ref state={sw.state} attrs={switchStateMapping} user={rest} />
