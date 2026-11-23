<!-- A scroll view inside a sheet: its scrolling is a gesture the sheet's pan waits for. -->
<script lang="ts">
	import { DefaultScrollGesture } from "@sohedra/lynx/gesture";
	import type { Gesture } from "@sohedra/lynx/gesture";

	let { name, scrolls }: { name: string; scrolls: Set<Gesture> } = $props();
	const scroll = new DefaultScrollGesture();
	$effect(() => {
		scrolls.add(scroll);
		return () => scrolls.delete(scroll);
	});
</script>

<scroll-view class="scroll-{name}" scroll-y main-thread:gesture={scroll}></scroll-view>
