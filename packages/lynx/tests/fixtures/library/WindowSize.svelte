<script lang="ts">
	// The page's size: the screen's from `systemInfo` as the page starts, then what the host's
	// `onWindowResize` says, in Lynx's layout units.
	import { host, systemInfo } from "@sohedra/lynx/host";
	import { on } from "svelte/events";

	const { pixelWidth, pixelHeight, pixelRatio } = systemInfo.current;
	let width = $state(pixelWidth / pixelRatio);
	let height = $state(pixelHeight / pixelRatio);

	$effect(() =>
		on(host, "onWindowResize", (newWidth, newHeight) => {
			width = newWidth;
			height = newHeight;
		}),
	);
</script>

<text class="size">{width}x{height}</text>
