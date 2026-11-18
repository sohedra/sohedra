<script lang="ts">
	const actions = [{ name: "activate", label: "Go" }];
	const rest = {
		muted: true,
		loop: false,
		"sticky-top": true,
		"span-count": 2,
		animation: { name: "fade" },
		title: "plain",
		hidden: null,
	};
	let shown = $state(true);
</script>

<view class="object" accessibility-actions={actions} data-config={{ a: 1 }}></view>
<view class="array" item-snap={["x", "y"]}></view>
<video class="bare" muted loop></video>
<input class="blank" placeholder="" />
<view class="spread" {...rest}></view>
<video class="explicit" muted={true} loop={false}></video>
<view class="styled" style:color="red" style="padding: 2px;"></view>
<view class="toggle" title={shown ? "on" : null} ontap={() => (shown = !shown)}></view>
<image class="picture" id={5} src="a.png"></image>
<scroll-view class="scroller"></scroll-view>
