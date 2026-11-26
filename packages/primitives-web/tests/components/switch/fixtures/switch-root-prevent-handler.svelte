<!-- An onclick that skips the switch's own handler. Unannotated, so `pnpm check` guards the type. -->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
</script>

<SwitchRoot
	style="display: inline-block; width: 16px; height: 16px"
	onclick={(event) => {
		event.preventSohedraHandler();
		event.currentTarget.dataset.prevented = String(event.sohedraHandlerPrevented);
	}}
/>
