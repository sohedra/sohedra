<script lang="ts">
	import { Counter } from "./counter.svelte.ts";

	interface Props {
		step: number;
	}
	let { step }: Props = $props();
	// svelte-ignore state_referenced_locally
	const counter = new Counter(step);
	const label = (count: number): string => `Count: ${count satisfies number}`;
</script>

<view class="add" ontap={() => counter.add()}><text>{label(counter.count)}</text></view>
