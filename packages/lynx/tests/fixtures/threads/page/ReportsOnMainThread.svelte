<!-- Reports an error with the package's reportError from a main-thread tap, then marks the element:
the mark shows the tap went on past the report. The shared import gives the main-thread function
the main thread's reportError, instead of capturing the background's. -->
<script lang="ts">
	import { reportError } from "@sohedra/lynx" with { runtime: "shared" };

	interface Element {
		setAttribute(name: string, value: unknown): void;
	}

	function onTap(event: { currentTarget: Element }) {
		"main thread";
		reportError(new Error("reported on the main thread"));
		event.currentTarget.setAttribute("reported", "yes");
	}
</script>

<view class="report" main-thread:ontap={onTap}></view>
