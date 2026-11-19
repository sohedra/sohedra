<script lang="ts">
	import { next, thread } from "./counted.ts";

	const n = next();
</script>

<text>{thread} {n}</text>
