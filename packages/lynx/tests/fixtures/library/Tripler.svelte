<script lang="ts">
	import { tripled } from "./triple.ts";

	let { log }: { log: unknown[] } = $props();
</script>

<view class="triple" ontap={() => tripled(14).then((value) => log.push(value))}></view>
