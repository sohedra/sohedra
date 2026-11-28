<!--
  Switches as a page renders them, each with a thumb: three named by a sibling label through their
  hidden input's id ("first", "second", "third"), and one with a generated id inside a wrapping
  label ("Notifications"). Every switch gets the props passed.
-->
<script lang="ts">
	import { Switch } from "#lib/components/switch/index.js";

	let {
		defaultChecked,
		disabled,
		readOnly,
		required,
	}: { defaultChecked?: boolean; disabled?: boolean; readOnly?: boolean; required?: boolean } =
		$props();

	const names = ["first", "second", "third"];
</script>

{#each names as name (name)}
	<div>
		<label for={name}>{name}</label>
		<Switch.Root id={name} {name} {defaultChecked} {disabled} {readOnly} {required}>
			<Switch.Thumb />
		</Switch.Root>
	</div>
{/each}
<label>
	<Switch.Root {defaultChecked} {disabled} {readOnly} {required}><Switch.Thumb /></Switch.Root>
	Notifications
</label>
