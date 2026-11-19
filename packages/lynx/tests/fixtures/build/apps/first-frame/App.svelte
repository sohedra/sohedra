<script lang="ts">
	let { title }: { title: string } = $props();
	let taps = $state(0);
</script>

<view class="first-frame-page" ontap={() => taps++}>
	<text>{title}: {taps}</text>
</view>
