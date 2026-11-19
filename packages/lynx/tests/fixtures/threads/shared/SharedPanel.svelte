<!--
	A shared package's component, which can tell the threads apart only by esm-env's BROWSER: on Lynx,
	the background.
-->
<script lang="ts">
	import { BROWSER } from "esm-env";

	import SharedField from "./SharedField.svelte";
</script>

{#if BROWSER}<SharedField />{:else}<SharedField />{/if}
<SharedField />
