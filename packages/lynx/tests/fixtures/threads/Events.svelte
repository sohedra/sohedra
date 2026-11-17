<script lang="ts">
	let log = $state<string[]>([]);
	const caughtProps = { oncatchtap: () => log.push("spread-caught") };
	const boundProps = { ontap: () => log.push("spread-bound") };
</script>

<view class="outer" ontap={() => log.push("outer")} ontapcapture={() => log.push("outer-capture")}>
	<view
		class="forms"
		ontap={() => log.push("bubble")}
		ontapcapture={() => log.push("capture")}
		oncatchtap={() => log.push("catch")}
		oncatchtapcapture={() => log.push("catch-capture")}
	>
		<text>forms</text>
	</view>
	<view class="caught" oncatchtap={() => log.push("caught")}><text>caught</text></view>
	<view class="bound" ontap={() => log.push("bound")}><text>bound</text></view>
	<view class="spread-caught" {...caughtProps}><text>spread-caught</text></view>
	<view class="spread-bound" {...boundProps}><text>spread-bound</text></view>
</view>
<text class="log">{log.join(",")}</text>
