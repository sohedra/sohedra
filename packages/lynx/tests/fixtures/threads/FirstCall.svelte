<script lang="ts">
	type Node = { invoke(method: string, params?: Record<string, unknown>): Promise<unknown> };
	let { handles }: { handles: Record<string, unknown> } = $props();
	let fresh = $state(false);
	const keep = (name: string) => (node: unknown) => {
		handles[name] = node;
	};
	const record = (name: string, call: Promise<unknown>) =>
		call.then((value) => (handles[`result-${name}`] = value));
</script>

<view class="holder">
	<view class="a" {@attach keep("a")}></view>
	<view class="b" {@attach keep("b")}></view>
	<view class="own" flatten={false} {@attach keep("own")}></view>
	<view class="told" flatten={true} {@attach keep("told")}></view>
	<view class="idle"></view>
</view>
<view
	class="pair"
	ontap={() => {
		void record("b", (handles["b"] as Node).invoke("boundingClientRect"));
		void record("a", (handles["a"] as Node).invoke("boundingClientRect"));
	}}
>
	<text>pair</text>
</view>
<view class="add" ontap={() => (fresh = true)}><text>add</text></view>
{#if fresh}
	<view
		class="fresh"
		{@attach (node) => void record("fresh", (node as Node).invoke("boundingClientRect"))}
	></view>
{/if}
