<!-- Reports what it is given with the package's reportError, from a tap. -->
<script lang="ts">
	import { reportError } from "@sohedra/lynx";

	let { reported }: { reported: unknown[] } = $props();
</script>

<view class="report" ontap={() => reported.forEach((value) => reportError(value))}></view>
