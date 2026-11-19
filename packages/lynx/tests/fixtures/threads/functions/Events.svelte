<!--
	Main-thread events in each spelling, written directly and through a spread, a handler whose
	captured value changes, and one that stops its event.
-->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	let step = $state(1);
	let bound = $state(true);

	function heard(what: string) {
		log.push(what);
	}

	function onTap() {
		"main thread";
		void runOnBackground(heard)(`tap ${step}`);
	}

	function onCatch() {
		"main thread";
		void runOnBackground(heard)("caught");
	}

	function onCapture() {
		"main thread";
		void runOnBackground(heard)("capture");
	}

	function onStop(event: { stopPropagation(): void }) {
		"main thread";
		event.stopPropagation();
		void runOnBackground(heard)("stopped");
	}

	function onOuter() {
		"main thread";
		void runOnBackground(heard)("outer");
	}

	function onSpread() {
		"main thread";
		void runOnBackground(heard)("spread");
	}

	const spread = $derived(bound ? { "main-thread:ontap": onSpread } : {});
	api["next"] = () => (step += 1);
	api["unbind"] = () => (bound = false);
	api["bind"] = () => (bound = true);
</script>

<view class="outer" main-thread:ontap={onOuter}>
	<view class="tap" main-thread:ontap={bound ? onTap : undefined}></view>
	<view class="catch" main-thread:oncatchtap={onCatch}></view>
	<view class="capture" main-thread:ontapcapture={onCapture}>
		<view class="inside"></view>
	</view>
	<view class="stop" main-thread:ontap={onStop}></view>
	<view class="spread" {...spread}></view>
</view>
