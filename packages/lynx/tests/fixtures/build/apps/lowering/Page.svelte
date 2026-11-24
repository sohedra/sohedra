<script>
	// Syntax PrimJS refuses or gets wrong, in a module both threads load: each check is true once the
	// build lowers it right.
	import { checks } from "./syntax.js";
</script>

<text>{checks.join(" ")}</text>
