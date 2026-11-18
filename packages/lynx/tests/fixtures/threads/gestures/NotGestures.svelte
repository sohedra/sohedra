<!-- Values under main-thread:gesture that are no gesture: an object, a list of gestures, a function. -->
<script lang="ts">
	import { PanGesture, TapGesture } from "@sohedra/lynx/gesture";

	const object = { type: 0, callbacks: {} };
	const list = [new PanGesture(), new TapGesture()];
	const plain = () => {};
</script>

<view class="object" {...{ "main-thread:gesture": object }}></view>
<view class="list" {...{ "main-thread:gesture": list }}></view>
<view class="plain" main-thread:gesture={plain}></view>
