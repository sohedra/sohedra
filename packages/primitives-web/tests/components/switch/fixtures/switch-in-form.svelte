<!--
  A switch in a plain `<form>` with Submit and Reset buttons, sized for a real pointer; submitting
  is prevented and reported through `onFormSubmit`. `form` renders the switch outside the form,
  `binding` binds `checked` to `$state` or to `get`/`set`.
-->
<script lang="ts">
	import SwitchRoot from "#lib/components/switch/switch-root.svelte";
	import type { SwitchRootProps } from "#lib/components/switch/switch-types.js";

	let {
		form,
		binding,
		initial,
		get = () => false,
		set = () => {},
		nativeCheckbox,
		onFormSubmit,
		onFormReset,
		style = "display: inline-block; width: 16px; height: 16px",
		...rest
	}: {
		binding?: "state" | "function";
		initial?: boolean;
		get?: () => boolean;
		set?: (value: boolean) => void;
		nativeCheckbox?: string;
		onFormSubmit?: (event: SubmitEvent) => void;
		onFormReset?: (event: Event) => void;
	} & SwitchRootProps = $props();

	// svelte-ignore state_referenced_locally
	let checked = $state(initial);

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		onFormSubmit?.(event);
	}
</script>

{#snippet control()}
	{#if binding === "state"}
		<SwitchRoot bind:checked {form} {style} {...rest} />
	{:else if binding === "function"}
		<SwitchRoot bind:checked={get, set} {form} {style} {...rest} />
	{:else}
		<SwitchRoot {form} {style} {...rest} />
	{/if}
{/snippet}

<form id={form} onsubmit={handleSubmit} onreset={onFormReset}>
	{#if !form}
		{@render control()}
	{/if}
	{#if nativeCheckbox}
		<input type="checkbox" name={nativeCheckbox} />
	{/if}
	<button type="submit">Submit</button>
	<button type="reset">Reset</button>
</form>
{#if form}
	{@render control()}
{/if}
<!-- Outside the form: an `<output>` inside it would be reset too. -->
<span data-testid="bound">{String(checked)}</span>
