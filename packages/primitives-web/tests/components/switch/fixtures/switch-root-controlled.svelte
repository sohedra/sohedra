<!--
  The controlled pattern: a plain `checked` the parent stores from `onCheckedChange`. The parent's
  own state, which the demo's props can't give.
-->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";

	let checked = $state(false);
</script>

<SwitchRoot
	{checked}
	onCheckedChange={(next) => (checked = next)}
	style="display: inline-block; width: 16px; height: 16px"
/>
<output data-testid="checked">{String(checked)}</output>
