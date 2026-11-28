<!--
  `usePopupUnmount` on a stand-in popup store: `awaiting` is its `awaitingUnmount`, the "popup"
  div its popup element and `onUnmount` its `unmount`. With `awaitOther`, the root is given the
  "other" div as the element whose exit animations it waits for. A real popup decides
  `awaitingUnmount` and its element itself, so the cases hold them on a stand-in instead.
-->
<script lang="ts">
	import {
		type PopupUnmountView,
		usePopupUnmount,
	} from "#lib/foundation/popup/popup-root.svelte.js";

	let {
		awaiting,
		awaitOther,
		onUnmount,
	}: { awaiting: boolean; awaitOther: boolean; onUnmount: () => void } = $props();

	let popup: HTMLElement | null = $state(null);
	let other: HTMLElement | null = $state(null);

	const store = {
		get awaitingUnmount() {
			return awaiting;
		},
		get popupElement() {
			return popup;
		},
		unmount: () => onUnmount(),
	} as unknown as PopupUnmountView;

	// svelte-ignore state_referenced_locally
	usePopupUnmount(store, awaitOther ? () => other : undefined);
</script>

<div data-testid="popup" {@attach (element) => void (popup = element)}></div>
<div data-testid="other" {@attach (element) => void (other = element)}></div>
