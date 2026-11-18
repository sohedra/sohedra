<!--
	Calls between the threads: main-thread functions the background runs, and background functions
	main-thread functions run, returning a value, a thenable, or throwing.
-->
<script lang="ts">
	import { mainThreadRef, runOnBackground, runOnMainThread } from "@sohedra/lynx";
	import { tick } from "svelte";

	interface Element {
		readonly dataset: Record<string, unknown>;
		invoke(method: string): Promise<unknown>;
	}

	let { log, api }: { log: unknown[]; api: Record<string, unknown> } = $props();
	let n = $state(0);
	let more = $state(false);
	const counter = mainThreadRef<Element | null>(null);
	const late = mainThreadRef<Element | null>(null);

	function add(a: number, b: number) {
		"main thread";
		return { sum: a + b };
	}

	function fail() {
		"main thread";
		throw new TypeError("The main thread failed.");
	}

	function wait(value: string) {
		"main thread";
		return new Promise((resolve) => setTimeout(() => resolve(`waited for ${value}`), 0));
	}

	function readN() {
		"main thread";
		return counter.current?.dataset["n"];
	}

	function measure() {
		"main thread";
		return late.current!.invoke("boundingClientRect");
	}

	function answer(value: number) {
		return value * 2;
	}

	async function answerLater(value: number) {
		await Promise.resolve();
		return `later ${value}`;
	}

	function failHere(): never {
		throw new RangeError("The background failed.");
	}

	function note(...args: unknown[]) {
		log.push(args);
	}

	function onAsk() {
		"main thread";
		runOnBackground(answer)(21).then(
			(value) => runOnBackground(note)("answer", value),
			() => {},
		);
		runOnBackground(answerLater)(1).then((value) => runOnBackground(note)("later", value));
		runOnBackground(failHere)().catch((error: Error) =>
			runOnBackground(note)("caught", error.name, error.message),
		);
	}

	function onNested() {
		"main thread";
		runOnMainThread(add)(1, 2).then((value) => runOnBackground(note)("nested", value));
	}

	function onIgnore() {
		"main thread";
		// Nobody awaits it: its rejection is reported once, where the function threw.
		void runOnBackground(failHere)();
	}

	function plain() {
		return 1;
	}

	api["add"] = (a: number, b: number) => runOnMainThread(add)(a, b);
	api["fail"] = () => runOnMainThread(fail)();
	api["wait"] = (value: string) => runOnMainThread(wait)(value);
	api["plain"] = () => runOnMainThread(plain)();
	api["count"] = async () => {
		n += 5;
		await tick();
		return runOnMainThread(readN)();
	};
	api["measure"] = async () => {
		more = true;
		await tick();
		return runOnMainThread(measure)();
	};
</script>

<view class="counter" data-n={n} main-thread:ref={counter}></view>
<view class="ask" main-thread:ontap={onAsk}></view>
<view class="ignore" main-thread:ontap={onIgnore}></view>
<view class="nested" main-thread:ontap={onNested}></view>
{#if more}
	<view class="late" main-thread:ref={late}></view>
{/if}
