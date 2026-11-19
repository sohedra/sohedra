<script lang="ts">
	// A source to copy and an empty place to put copies in. The nodes go to `handles`.
	let {
		handles,
		tone = "calm",
	}: {
		// oxlint-disable-next-line typescript/no-explicit-any -- the test reads what the attachments got
		handles: Record<string, any>;
		tone?: string;
	} = $props();
</script>

<view class="outer">
	<view
		class="source"
		id="source"
		style="width: 100px; height: 40px;"
		data-tone={tone}
		ontap={() => handles.taps++}
		{@attach (node) => void (handles.source = node)}
	>
		<text class="title">Title</text>
		<view class="inner" id="inner"><text class="deep">Deep</text></view>
	</view>
	<view class="holder" {@attach (node) => void (handles.holder = node)}></view>
</view>

<style>
	.source {
		color: red;
	}
</style>
