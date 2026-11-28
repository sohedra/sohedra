<!--
  A parent passing a plain (unbound) `checked` it can set through `setChecked`: the parent's own
  state, which the demo's props can't give.
-->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";

	let checked = $state(false);

	export function setChecked(value: boolean) {
		checked = value;
	}
</script>

<SwitchRoot {checked} style="display: inline-block; width: 16px; height: 16px" />
