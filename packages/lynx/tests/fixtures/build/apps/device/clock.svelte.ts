// State with an effect, made as the page's modules load: Svelte schedules the effect then, before
// the page starts.

export const clock = $state({ ticks: 0, seen: 0 });

$effect.root(() => {
	$effect(() => {
		clock.seen = clock.ticks;
	});
});
