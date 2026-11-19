<!-- Listens to touches on the page's root in its top-level code, which runs on the main thread as
the first frame is drawn. -->
<script lang="ts">
	import { root } from "@sohedra/lynx";
	import { on } from "svelte/events";

	on(root, "touchstart", () => {});
</script>

<view><text>first frame</text></view>
