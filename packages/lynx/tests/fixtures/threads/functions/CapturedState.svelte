<!--
	Main-thread functions that capture $state whole: an array, an object holding an object and a Date,
	and a number. A function ref runs again each time what it captured is rebuilt.
-->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	let items = $state([1]);
	let settings = $state({ size: { n: 0 }, when: new Date(0) });
	let count = $state(0);

	function heard(what: string) {
		log.push(what);
	}

	api["push"] = () => items.push(items.length + 1);
	api["nested"] = () => settings.size.n++;
	api["count"] = () => count++;
	api["date"] = () => (settings.when = new Date(1000));

	function onTap() {
		"main thread";
		void runOnBackground(heard)(`tap ${String(items)} ${JSON.stringify(settings)} ${count}`);
	}

	function onRef() {
		"main thread";
		void runOnBackground(heard)(`ref ${JSON.stringify(settings)}`);
	}
</script>

<view class="tap" main-thread:ontap={onTap} main-thread:ref={onRef}></view>
