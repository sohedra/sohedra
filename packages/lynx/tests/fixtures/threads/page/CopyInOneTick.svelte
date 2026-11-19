<!-- A static copy made by a tap, in one tick with changes to its root, a sibling's change and a UI
call; one made by an effect of the first mount; and a popup's copy whose size code sets. -->
<script lang="ts">
	import { createStaticCopy } from "@sohedra/lynx";
	import type { StaticCopy } from "@sohedra/lynx";

	type Node = Parameters<typeof createStaticCopy>[1];
	let {
		results,
		onMount = false,
	}: { results: { copy?: StaticCopy; sizes: unknown[] }; onMount?: boolean } = $props();
	let label = $state("a");
	let source: Node | undefined;
	let holder: Node | undefined;
	let popup: Node | undefined;
	let viewport: Node | undefined;

	$effect(() => {
		if (onMount) results.copy = createStaticCopy(source!, holder!);
	});

	function copyNow() {
		const copy = createStaticCopy(source!, holder!);
		results.copy = copy;
		const root = copy.nodes[0]!;
		root.setAttribute("data-copied", "yes");
		root.setStyleProperty("opacity", "0.5");
		label = "b";
		void root.invoke("boundingClientRect").then((size) => results.sizes.push(size));
	}

	function measurePopup() {
		const copy = createStaticCopy(popup!, viewport!);
		results.copy = copy;
		copy.nodes[0]!.setStyleProperties({
			"--popup-width": "auto",
			"--popup-height": "auto",
			position: "relative",
		});
	}
</script>

<view class="page">
	<view class="source" id="source" {@attach (node) => void (source = node as Node)}>
		<text>{label}</text>
	</view>
	<view class="holder" {@attach (node) => void (holder = node as Node)}></view>
	<view class="go" ontap={copyNow}></view>
	<view class="popup" style="--popup-width: 106px;" {@attach (node) => void (popup = node as Node)}>
		<view class="popup-child"></view>
	</view>
	<view class="viewport" {@attach (node) => void (viewport = node as Node)}></view>
	<view class="measure" ontap={measurePopup}></view>
</view>
