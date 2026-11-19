<!-- A main-thread tap that calls a background function at once, and an element to ask Lynx about. -->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";

	let { log, handles }: { log: unknown[]; handles: Record<string, unknown> } = $props();
	function record(value: unknown) {
		log.push(value);
	}

	function onMainTap() {
		"main thread";
		void runOnBackground(record)("main-thread tap");
	}
</script>

<view class="main" main-thread:ontap={onMainTap} {@attach (node) => void (handles["node"] = node)}
></view>
