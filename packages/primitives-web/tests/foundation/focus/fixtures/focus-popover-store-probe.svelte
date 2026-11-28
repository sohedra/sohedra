<!-- Hands the enclosing popover's store out. -->
<script lang="ts">
	import type { PopoverStore } from "@sohedra/primitives-core/components/popover/index.js";

	import { PopoverRootContext } from "#lib/components/popover/popover-context.js";
	import type { WebTypes } from "#lib/foundation/kernel/index.js";

	let { onStore }: { onStore: (store: PopoverStore<unknown, WebTypes>) => void } = $props();

	// svelte-ignore state_referenced_locally
	onStore(PopoverRootContext.get());
</script>
