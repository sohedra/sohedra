<!--
  `usePopupUnmount` on a stand-in popup store: `awaiting` is its `awaitingUnmount`, the "popup"
  div its popup element and `onUnmount` its `unmount`. With `awaitOther`, the root is given the
  "other" div as the element whose exit animations it waits for. A real popup decides
  `awaitingUnmount` and its element itself, so the cases hold them on a stand-in instead.
-->
<script lang="ts">
	import type { PopupView } from "@sohedra/primitives-core/foundation/popup/index.js";

	import type { WebTypes } from "#lib/foundation/kernel/index.js";
	import { usePopupUnmount } from "#lib/foundation/popup/popup-unmount.svelte.js";

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
	} as unknown as PopupView<WebTypes>;

	// svelte-ignore state_referenced_locally
	usePopupUnmount(store, awaitOther ? () => ({ element: other }) : undefined);
</script>

<div data-testid="popup" {@attach (element) => void (popup = element)}></div>
<div data-testid="other" {@attach (element) => void (other = element)}></div>
