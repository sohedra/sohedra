<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";

	let saved = $state(0);
	const header = mainThreadRef<{ setStyleProperty(name: string, value: string): void } | null>(
		null,
	);

	function save(top: number) {
		saved = top;
	}

	function onScroll(event: { detail: { scrollTop: number } }) {
		"main thread";
		header.current?.setStyleProperty("opacity", "main-thread-ok");
		runOnBackground(save)(event.detail.scrollTop);
	}
</script>

<view main-thread:ref={header}><text>saved {saved}</text></view>
<scroll-view main-thread:onscroll={onScroll}></scroll-view>
