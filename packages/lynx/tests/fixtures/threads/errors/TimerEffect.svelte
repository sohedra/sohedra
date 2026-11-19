<!-- A count a timer changes, and an effect that throws while it is odd. `later` stands in for Lynx's
background timer. -->
<script lang="ts">
	let { later }: { later: (run: () => void) => void } = $props();

	let count = $state(0);

	$effect(() => {
		if (count % 2 === 1) throw new Error(`the effect threw at ${count}`);
	});
</script>

<view class="more" ontap={() => later(() => count++)}><text>{count}</text></view>
