<!-- Reads SwitchRootContext (the switch store) and shows whether the switch is checked. -->
<script lang="ts">
	import { SwitchRootContext } from "#lib/components/switch/context.js";

	const store = SwitchRootContext.get();
</script>

<span data-testid="context">{store.checked ? "checked" : "unchecked"}</span>
