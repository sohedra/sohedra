<!-- A component that imports `devalue` itself, and draws with it in the first frame. -->
<script lang="ts">
	import { stringify } from "devalue";
</script>

<view><text>S:{stringify({ a: 1 })}</text></view>
