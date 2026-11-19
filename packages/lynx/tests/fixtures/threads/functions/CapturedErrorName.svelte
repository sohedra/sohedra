<!-- A main-thread function that captures $state holding errors named like members every object has. -->
<script lang="ts">
	import { runOnBackground } from "@sohedra/lynx";

	class Held {
		inner: Error;
		constructor(name: string) {
			this.inner = Object.assign(new Error("m"), { name });
		}
	}

	let { log }: { log: unknown[] } = $props();
	let held = $state({ a: new Held("toString"), b: new Held("constructor") });

	function heard(what: string) {
		log.push(what);
	}

	function onTap() {
		"main thread";
		void runOnBackground(heard)(JSON.stringify(held));
	}
</script>

<view class="tap" main-thread:ontap={onTap}><text>tap</text></view>
