<script lang="ts">
	import DeferredRow from "./DeferredRow.svelte";

	// A feed of deferred rows on Lynx's async list, in an `{#if}`, with what may stand around them: a
	// header and a footer with no `defer`, a deferred row that spans the line, a second `{#each}`,
	// and the list's attributes that set its first screen.
	let {
		handles,
		count = 30,
		more = 0,
		header = false,
		footer = false,
		defer = true,
		fullSpan = false,
		span,
		preload,
		initial,
		scrollIndex,
	}: {
		handles: Record<string, unknown>;
		count?: number;
		/** The rows of a second `{#each}`, after the first. */
		more?: number;
		header?: boolean;
		footer?: boolean;
		defer?: boolean | { unmountRecycled?: boolean };
		/** The header, deferred, spans the whole line. */
		fullSpan?: boolean;
		span?: number;
		preload?: number;
		initial?: number;
		scrollIndex?: number;
	} = $props();
	const rows = (from: number, length: number) =>
		Array.from({ length }, (_, index) => ({ id: from + index, label: `Row ${from + index}` }));
	const feed = $state({ rows: rows(1, count), more: rows(1001, more), shown: true });
	// The list's attributes, which a test may change after the page starts.
	const screen = $state({ span, preload, initial });
	handles["feed"] = feed;
	handles["screen"] = screen;
	handles["rendered"] ??= [];
	handles["unmounted"] ??= [];
</script>

<list
	class="list"
	custom-list-name="list-container"
	span-count={screen.span}
	preload-buffer-count={screen.preload}
	initial-item-count={screen.initial}
	initial-scroll-index={scrollIndex}
>
	{#if header}
		<list-item item-key="header"><text class="header">Header</text></list-item>
	{/if}
	{#if fullSpan}
		<list-item item-key="wide" full-span {defer}><text class="wide">Wide</text></list-item>
	{/if}
	{#if feed.shown}
		{#each feed.rows as row (row.id)}
			<list-item item-key="r{row.id}" {defer}>
				<DeferredRow {row} {handles} />
			</list-item>
		{/each}
	{/if}
	{#each feed.more as row (row.id)}
		<list-item item-key="m{row.id}" {defer}>
			<DeferredRow {row} {handles} />
		</list-item>
	{/each}
	{#if footer}
		<list-item item-key="footer"><text class="footer">Loading more</text></list-item>
	{/if}
</list>
