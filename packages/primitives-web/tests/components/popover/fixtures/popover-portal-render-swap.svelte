<!-- One open popover whose Portal switches between two render snippets (and none). -->
<script lang="ts">
	import { Popover } from "#lib/components/popover/index.js";
	import type { RenderSnippetProps } from "#lib/foundation/kernel/index.js";

	let {
		container,
		mode = "none",
	}: { container: HTMLElement; mode?: "none" | "section" | "article" } = $props();
</script>

{#snippet asSection({ props, children }: RenderSnippetProps<unknown>)}
	<section {...props}>{@render children?.()}</section>
{/snippet}

{#snippet asArticle({ props, children }: RenderSnippetProps<unknown>)}
	<article {...props}>{@render children?.()}</article>
{/snippet}

<p>before</p>
<Popover.Root defaultOpen>
	<Popover.Trigger>Trigger</Popover.Trigger>
	<Popover.Portal
		{container}
		render={mode === "section" ? asSection : mode === "article" ? asArticle : undefined}
	>
		<Popover.Positioner>
			<Popover.Popup data-testid="popup">Popup</Popover.Popup>
		</Popover.Positioner>
	</Popover.Portal>
</Popover.Root>
<p>after</p>
