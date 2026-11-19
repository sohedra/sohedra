<!-- A page that mounts layers above itself: from an effect, a tap and a promise, and from what the
test calls, as a timer would. -->
<script lang="ts">
	import { mount, unmount } from "@sohedra/lynx";
	import { getAllContexts, setContext } from "svelte";

	import Layer from "./Layer.svelte";

	type Place = { target?: unknown; anchor?: unknown };
	let {
		handles,
		log,
		inEffect = false,
	}: { handles: Record<string, unknown>; log: unknown[]; inEffect?: boolean } = $props();

	setContext("theme", "dark");
	const context = getAllContexts();
	const keep = (name: string) => (node: unknown) => {
		handles[name] = node;
	};

	$effect(() => {
		if (inEffect) handles["fromEffect"] = mount(Layer, { props: { label: "effect", log } });
	});
	handles["open"] = (label: string, withContext: boolean, place: Place = {}) =>
		mount(Layer, { props: { label, log }, ...(withContext && { context }), ...(place as object) });
	handles["fromPromise"] = async (label: string) => {
		await Promise.resolve();
		return mount(Layer, { props: { label, log }, context });
	};
</script>

<view class="page">
	<view
		class="open"
		ontap={() => (handles["fromHandler"] = mount(Layer, { props: { label: "handler", log } }))}
	>
		<text>open</text>
	</view>
	<view class="box" {@attach keep("box")}>
		<text class="first" {@attach keep("first")}>first</text>
		<text class="second">second</text>
	</view>
</view>
<view class="tail"><text>tail</text></view>
