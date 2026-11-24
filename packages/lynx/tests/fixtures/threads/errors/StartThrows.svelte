<!--
	A page whose root throws on the background as it mounts, where `throws` says: in its script, in
	its template, in a child outside any boundary, in an effect, or by reading a global Lynx lacks;
	`none` throws nowhere. The first frame draws it whole. A tap on `.tap` goes to a background
	handler; one on `.call` runs a main-thread function that counts its runs on its element, calls
	the background, and writes there how the call ended.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground } from "@sohedra/lynx";
	import { background } from "@sohedra/lynx/env";

	import StartThrowsChild from "./StartThrowsChild.svelte";

	interface TapEvent {
		currentTarget: { setAttribute(name: string, value: unknown): void };
	}

	let {
		log,
		throws,
	}: { log: unknown[]; throws: "script" | "template" | "child" | "effect" | "global" | "none" } =
		$props();
	const runs = mainThreadRef(0);

	function note(...args: unknown[]) {
		log.push(args);
	}

	function called(event: TapEvent) {
		"main thread";
		runs.current++;
		event.currentTarget.setAttribute("runs", runs.current);
		runOnBackground(note)("called").then(
			() => event.currentTarget.setAttribute("answered", "yes"),
			(error: { code?: string }) => event.currentTarget.setAttribute("refused", error.code),
		);
	}

	function label(): string {
		if (background && throws === "template") throw new Error("the template threw at start");
		return "call";
	}

	if (background && throws === "script") throw new Error("the script threw at start");
	// As the engine words a read of a global it lacks.
	if (background && throws === "global") throw new ReferenceError("URL is not defined");

	$effect(() => {
		if (background && throws === "effect") throw new Error("the effect threw at start");
	});
</script>

<view class="page">
	<view class="tap" ontap={() => log.push("tap")}><text>tap</text></view>
	<view class="call" main-thread:ontap={called}><text>{label()}</text></view>
	<StartThrowsChild {throws} />
</view>
