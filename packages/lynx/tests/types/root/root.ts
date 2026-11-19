// Checked by `pnpm check`, not run. `on(root, …)` from `svelte/events` listens on the page's root:
// its handler gets the event with the root as `currentTarget`, and its one option is `capture`.

import { root } from "@sohedra/lynx";
import { on } from "svelte/events";

const off: () => void = on(root, "tap", (event) => {
	const type: string = event.type;
	const target: unknown = event.target;
	const self: typeof root = event.currentTarget;
	void [type, target, self];
});
off();
on(root, "touchstart", () => {}, { capture: true });
on(root, "tap", () => {}, { capture: false });
const tag: "page" = root.tag;
const connected: boolean = root.isConnected;
void [tag, connected, root.contains(null)];
const listener = () => {};
root.addEventListener("tap", listener, { capture: true });
root.removeEventListener("tap", listener, { capture: true });

// @ts-expect-error capture is a boolean.
on(root, "tap", () => {}, { capture: "yes" });
// @ts-expect-error the root is a value, not a function.
root();
// @ts-expect-error a handler takes the event, and the event's type is text.
on(root, "tap", (event: { type: number }) => event);
