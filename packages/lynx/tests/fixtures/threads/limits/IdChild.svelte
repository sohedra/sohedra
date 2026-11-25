<!--
	A component that shows its $props.id().
-->
<script lang="ts">
	let { name }: { name: string } = $props();
	const uid = $props.id();
</script>

<text class="s-{name}" id={uid}>{name}</text>
