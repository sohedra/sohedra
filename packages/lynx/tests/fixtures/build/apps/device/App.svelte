<script lang="ts">
	// What a first page uses: state, a tap, a keyed list, a `style` with a `style:` directive, and
	// state with an effect made as its modules load.
	// The page itself uses nothing a device's engine lacks: the binding fills no gap for an app.
	import { clock } from "./clock.svelte.ts";

	let count = $state(0);
	let fruits = $state([
		{ id: 1, name: "Apple" },
		{ id: 2, name: "Banana" },
	]);

	function tap() {
		count++;
		clock.ticks++;
		fruits = [...fruits].reverse();
	}
</script>

<view class="page" style="padding: 8px" style:opacity={count % 2 === 0 ? 1 : 0.5}>
	<view class="button" ontap={tap}>
		<text>Tapped {count}, seen {clock.seen}</text>
	</view>
	{#each fruits as fruit (fruit.id)}
		<text>{fruit.name}</text>
	{/each}
</view>
