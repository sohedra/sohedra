<!--
	Blocks inside a <text>: Svelte hands a block the empty text after an empty comment there.
-->
<script lang="ts">
	import { mainThread } from "@sohedra/lynx/environment";

	import InTextChild from "./InTextChild.svelte";
	let { b = false }: { b?: boolean } = $props();
</script>

<text
	>{#if !mainThread}<InTextChild {b} />{:else}<InTextChild {b} />{/if}</text
>
