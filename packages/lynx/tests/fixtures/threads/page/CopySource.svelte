<!-- A source to copy and two empty places to put copies in: the nodes go to `handles`. -->
<script lang="ts">
	let { handles, withList = false }: { handles: Record<string, unknown>; withList?: boolean } =
		$props();
	let showHolder = $state(true);
	// Text outside a <text>, which Lynx shows nowhere.
	let gap = $state(" ");
	handles["hideHolder"] = () => (showHolder = false);
	const keep = (name: string) => (node: unknown) => {
		handles[name] = node;
	};
	const shape = { corners: [4, 8], kind: "card" };
</script>

<view class="outer">
	<view
		class="source"
		id="source"
		style="width: 100px; height: 40px;"
		data-kind="card"
		data-tone="calm"
		data-shape={shape}
		aria-label="Source"
		accessibility-element={true}
		ontap={() => (handles["taps"] = (handles["taps"] as number) + 1)}
		main-thread:ontap={() => {
			"main thread";
		}}
		{@attach keep("source")}
	>
		<text class="title" {@attach keep("title")}>Title</text>
		<image class="picture" src="https://example.test/picture.png" />
		<view class="inner" id="inner" data-depth={2}><text class="deep">Deep</text></view>
		{#if withList}
			<view class="wrapper">
				<list class="feed" list-type="single" span-count={1} {@attach keep("feed")}>
					<list-item item-key="a" reuse-identifier="row"><text>Row</text></list-item>
				</list>
			</view>
		{/if}
	</view>
	<view class="second" id="second"><text>Second</text></view>
	<view class="loose" {@attach keep("loose")}>{gap}<text>in</text></view>
	{#if showHolder}
		<view class="holder" {@attach keep("holder")}></view>
	{/if}
	<view class="other" {@attach keep("other")}></view>
</view>

<style>
	.source {
		color: red;
	}
</style>
