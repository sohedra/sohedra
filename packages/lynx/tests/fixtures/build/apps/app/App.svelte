<script lang="ts">
	import { probe } from "./probe.ts";
</script>

<view class="page">
	<text class="label caption">{probe}</text>
</view>

<style>
	.page .label,
	.page .caption {
		margin-top: 4px;
	}
	.page {
		padding: 8px;
	}
</style>
