<!--
	A deferred row that holds an {#await}.
-->
<script lang="ts">
	let { given, log }: { given: unknown; log: unknown[] } = $props();
</script>

<list class="page-list" custom-list-name="list-container" preload-buffer-count={0}>
	<list-item item-key="s0" defer={{ unmountRecycled: true }}>
		{#await given}
			<text class="s-pend" ontap={() => log.push("s-pend")}>pending</text>
		{:then value}
			<text class="s-then" ontap={() => log.push("s-then")}>then</text>
		{/await}
	</list-item>
</list>
