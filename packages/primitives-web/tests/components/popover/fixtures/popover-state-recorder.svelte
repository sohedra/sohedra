<!--
  Reports the state it receives each time it changes, before the DOM updates.
-->
<script lang="ts" generics="State">
	let { state, onState }: { state: State; onState: (state: State) => void } = $props();

	$effect.pre(() => {
		onState(state);
	});
</script>
