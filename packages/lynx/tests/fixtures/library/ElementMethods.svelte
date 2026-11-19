<script lang="ts">
	// Main-thread functions that use an element's own methods, as an app's would: each one reads or
	// changes the element its ref holds.
	import { mainThreadRef, runOnMainThread } from "@sohedra/lynx";
	import type { MainThread } from "@sohedra/lynx/elements";

	let { log }: { log: unknown[] } = $props();

	const box = mainThreadRef<MainThread.Element | null>(null);

	const report = (value: unknown) => log.push(value);

	function style(): void {
		"main thread";
		box.current!.setStyleProperty("opacity", "0.5");
		box.current!.setStyleProperties({ width: "10px", height: "20px" });
	}

	function attributes(): string {
		"main thread";
		box.current!.setAttribute("marked", "set");
		return `${String(box.current!.getAttribute("marked"))} ${box.current!.getAttributeNames().join(",")}`;
	}

	function found(): string {
		"main thread";
		return `${box.current!.querySelector(".inner") !== null} ${box.current!.querySelectorAll("text").length}`;
	}

	function computed(): string {
		"main thread";
		return box.current!.getComputedStyleProperty("opacity");
	}

	function animated(): string {
		"main thread";
		const animation = box.current!.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100 });
		animation.pause();
		animation.play();
		animation.cancel();
		return "animated";
	}

	function invoked(): string {
		"main thread";
		void box.current!.invoke("boundingClientRect");
		return "invoked";
	}
</script>

<view class="box" main-thread:ref={box}>
	<view class="inner"><text>One</text></view>
	<text>Two</text>
</view>
<view class="style" ontap={() => runOnMainThread(style)()}></view>
<view class="attributes" ontap={() => runOnMainThread(attributes)().then(report)}></view>
<view class="found" ontap={() => runOnMainThread(found)().then(report)}></view>
<view class="computed" ontap={() => runOnMainThread(computed)().then(report)}></view>
<view class="animated" ontap={() => runOnMainThread(animated)().then(report)}></view>
<view class="invoked" ontap={() => runOnMainThread(invoked)().then(report)}></view>
