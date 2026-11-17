<script lang="ts">
	type Node = { invoke(method: string, params?: Record<string, unknown>): Promise<unknown> };
	let { handles }: { handles: Record<string, unknown> } = $props();
	let fresh = $state(false);
	let doomed = $state(false);
	const keep = (name: string) => (node: unknown) => {
		handles[name] = node;
	};
	const record = (name: string, call: Promise<unknown>) =>
		call.then(
			(value) => (handles[`result-${name}`] = { ok: value }),
			(error: Error & { code?: string }) => (handles[`result-${name}`] = { error: error.code }),
		);
</script>

<scroll-view class="scroller" scroll-y {@attach keep("scroller")}>
	<view class="row first" {@attach keep("first")}><text>one</text></view>
	<view class="row"><text>two</text></view>
</scroll-view>
<view class="box" ontap={() => {}} {@attach keep("box")}></view>
<view class="add" ontap={() => (fresh = true)}><text>add</text></view>
{#if fresh}
	<view
		class="fresh"
		ontap={() => {}}
		{@attach (node) => void record("fresh", (node as Node).invoke("boundingClientRect"))}
	></view>
	<view class="after"><text>after</text></view>
{/if}
{#if !doomed}
	<view class="doomed" ontap={() => {}} {@attach keep("doomed")}></view>
{/if}
<view
	class="doom"
	ontap={() => {
		void record("doomed", (handles["doomed"] as Node).invoke("boundingClientRect"));
		doomed = true;
	}}
>
	<text>doom</text>
</view>
