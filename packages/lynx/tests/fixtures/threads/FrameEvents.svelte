<script lang="ts">
	let { log }: { log: unknown[] } = $props();
</script>

<scroll-view
	class="scroller"
	onscroll={(event: { detail?: unknown }) => log.push(["scroll", event.detail])}
>
	<view class="outer" ontap={() => log.push(["outer"])}>
		<view class="caught" oncatchtap={() => log.push(["caught"])}>
			<text class="inside">inside</text>
		</view>
		<view class="bubbles" ontap={() => log.push(["bubbles"])}><text class="leaf">leaf</text></view>
	</view>
</scroll-view>
