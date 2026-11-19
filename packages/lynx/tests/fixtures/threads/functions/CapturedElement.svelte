<!--
	A main-thread function that captures $state holding one of the background's elements, by mistake,
	once the element is attached, beside a count the page shows.
-->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	let box: unknown = $state(null);
	let count = $state(0);
	const keep = (found: unknown) => {
		box = found;
	};

	function heard(what: string) {
		log.push(what);
	}

	api["count"] = () => count++;

	function onTap() {
		"main thread";
		void runOnBackground(heard)(`tap ${String(box)}`);
	}
</script>

<view class="box" {@attach keep} main-thread:ontap={onTap}><text>count {count}</text></view>
