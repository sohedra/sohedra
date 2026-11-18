<script lang="ts">
	import { tick } from "svelte";

	type Node = {
		getAttribute(name: string): unknown;
		invoke(method: string, params?: Record<string, unknown>): Promise<unknown>;
	};
	let { handles }: { handles: Record<string, unknown> } = $props();
	let wide = $state(false);
	let node: Node | undefined;
	handles["grow"] = async () => {
		wide = true;
		await tick();
		handles["class"] = node!.getAttribute("class");
		return node!.invoke("boundingClientRect");
	};
</script>

<view
	class={wide ? "box wide" : "box"}
	ontap={() => {}}
	{@attach (element) => {
		node = element as Node;
	}}
></view>
