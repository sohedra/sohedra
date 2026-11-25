<!-- A child that throws on the background as it mounts, when its parent says so. -->
<script lang="ts">
	import { background } from "@sohedra/lynx/environment";

	let { throws }: { throws: string } = $props();

	if (background && throws === "child") throw new Error("the child threw at start");
</script>

<text class="child">child</text>
