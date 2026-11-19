<script lang="ts">
	// An action that takes an object and updates, and no copy of state anywhere: before each update,
	// Svelte walks the object (`deep_read_state`), which tests it with `instanceof EventTarget`.
	let taps = $state(0);
	let updatedWith = $state("none");

	function track(_element: unknown, _value: { taps: number }) {
		return {
			update(value: { taps: number }) {
				updatedWith = String(value.taps);
			},
		};
	}
</script>

<view class="button" ontap={() => taps++} use:track={{ taps }}>
	<text>Updated with {updatedWith}</text>
</view>
