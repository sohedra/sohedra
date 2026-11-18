<!--
	Rows whose main-thread handler captures a ref that starts as an object, as a slider's does: the
	ref's initial value rides in every copy of every function that captures it.
-->
<script lang="ts">
	import { mainThreadRef } from "@sohedra/lynx";

	let { count = 100 }: { count?: number } = $props();
	const rows = Array.from({ length: count }, (_, index) => index + 1);
	const drag = mainThreadRef({ start: 0, offset: 0, velocity: 0, width: 0, active: false });

	function onTouch(event: { detail: { x: number } }) {
		"main thread";
		drag.current.offset = event.detail.x - drag.current.start;
	}
</script>

{#each rows as id (id)}
	<view class="row row-{id}" main-thread:ontouchmove={onTouch}></view>
{/each}
