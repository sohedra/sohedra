<script lang="ts">
	// Svelte's paths that copy or walk state: `$state.snapshot` as the component starts (on both
	// threads) and in a tap, `$inspect`, `{@debug}`, and an action that takes an object and updates.
	let data = $state({
		when: new Date(0),
		sizes: new Map([["a", 1]]),
		rows: [
			[1, 2],
			[3, [4]],
		] as unknown[][],
	});
	let taps = $state(0);
	let updatedWith = $state("none");

	$inspect(data);

	/** The copy's fields as text, and whether its date and map are copies of the state's own. */
	function describe(copy: $state.Snapshot<typeof data>): string {
		const copied = copy.when !== data.when && copy.sizes !== data.sizes;
		return `${copy.when.getTime()} ${copy.sizes.get("a")} ${JSON.stringify(copy.rows)} ${copied}`;
	}

	let copied = $state(describe($state.snapshot(data)));

	function tap() {
		taps++;
		data.rows[0]!.push(taps);
		copied = describe($state.snapshot(data));
	}

	function track(_element: unknown, _value: { taps: number }) {
		return {
			update(value: { taps: number }) {
				updatedWith = String(value.taps);
			},
		};
	}
</script>

{@debug taps}
<view class="button" ontap={tap} use:track={{ taps }}>
	<text>{copied}</text>
	<text>Updated with {updatedWith}</text>
</view>
