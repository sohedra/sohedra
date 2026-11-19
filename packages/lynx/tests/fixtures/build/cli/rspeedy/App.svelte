<script lang="ts">
	let count = $state(0);
</script>

<view class="button" ontap={() => count++}>
	<text>Tapped {count}</text>
</view>
