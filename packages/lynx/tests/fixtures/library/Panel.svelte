<script lang="ts">
	let open = $state(false);
</script>

<view
	class="panel {open ? 'open' : ''}"
	data-state={open ? "open" : "closed"}
	ontap={() => (open = !open)}
>
	<text>{open ? "Open" : "Closed"}</text>
</view>
