<!--
  Reads SwitchRootContext (the switch store), as a part named `Switch.ContextReader`, and shows
  whether the switch is checked: a child of the root, which the demo doesn't render.
-->
<script lang="ts">
	import { SwitchRootContext } from "#lib/components/switch/switch-context.js";

	const store = SwitchRootContext.get("Switch.ContextReader");
</script>

<span data-testid="context">{store.checked ? "checked" : "unchecked"}</span>
