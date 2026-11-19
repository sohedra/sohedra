<!-- What throws where on a page, one tap each: a handler, an effect a timer's change runs, a timer,
a promise nobody handles, the app's own report, a main-thread function, a background function a
main-thread function calls, values that are not errors, and the global timer an app's code calls. `later` stands in for
Lynx's background timer, which runs its callback on the background and reports what it throws. -->
<script lang="ts">
	import { reportError, runOnBackground } from "@sohedra/lynx";

	let { later }: { later: (run: () => void) => void } = $props();

	let changed = $state(0);
	let main = $state("");

	$effect(() => {
		if (changed > 0) throw new Error("the effect threw");
	});

	function onMainThreadTap() {
		"main thread";
		throw new Error("the main-thread function threw");
	}

	function fails() {
		throw new Error("the background function threw");
	}

	function onMainThreadObject() {
		"main thread";
		throw { status: 418 };
	}

	function onCallTap() {
		"main thread";
		runOnBackground(fails)().catch(() => {});
	}
</script>

<view
	class="handler"
	ontap={() => {
		throw new Error("the handler threw");
	}}
></view>
<view class="effect" ontap={() => later(() => changed++)}></view>
<view
	class="timer"
	ontap={() =>
		later(() => {
			throw new Error("the timer threw");
		})}
></view>
<view class="rejection" ontap={() => void Promise.reject(new Error("nobody handled it"))}></view>
<view class="report" ontap={() => reportError("the app reported it")}></view>
<view class="main-thread" main-thread:ontap={onMainThreadTap}><text>{main}</text></view>
<view class="call" main-thread:ontap={onCallTap}></view>
<view
	class="object-404"
	ontap={() => {
		throw { status: 404 };
	}}
></view>
<view
	class="object-500"
	ontap={() => {
		throw { status: 500, reason: "the server failed" };
	}}
></view>
<view class="report-503" ontap={() => reportError({ status: 503 })}></view>
<view class="main-thread-object" main-thread:ontap={onMainThreadObject}></view>
<view
	class="global-timer"
	ontap={() =>
		setTimeout(() => {
			throw new Error("the global timer threw");
		})}
></view>
<view
	class="coded"
	ontap={() => reportError(Object.assign(new Error("reset"), { code: "ECONNRESET" }))}
></view>
<view
	class="odd-stack"
	ontap={() => reportError(Object.assign(new Error("odd stack"), { stack: 42 }))}
></view>
