// Checked by `pnpm check`, not run. `mountPage` takes the root component and its props, as an object
// or as a function of the page's data and the host's global props, and a context.

import { mountPage } from "@sohedra/lynx";
import type { MountPageOptions } from "@sohedra/lynx";
import type { Component } from "svelte";

declare const App: Component<{ title: string }>;
declare const Plain: Component;

mountPage(App, { props: { title: "Inbox" } });
mountPage(App, {
	props: (data, globals) => ({ title: `${String(data["title"])} ${String(globals["x"])}` }),
});
mountPage(App, { props: { title: "Inbox" }, context: new Map([["theme", "dark"]]) });
mountPage(Plain);
const options: MountPageOptions<{ title: string }> = { props: { title: "Inbox" } };
mountPage(App, options);

// @ts-expect-error a prop the component does not have.
mountPage(App, { props: { title: "Inbox", count: 1 } });
// @ts-expect-error the function returns the component's props.
mountPage(App, { props: () => ({ title: 1 }) });
// @ts-expect-error the context is a map.
mountPage(App, { props: { title: "Inbox" }, context: { theme: "dark" } });
// @ts-expect-error mountPage returns nothing to unmount: the page goes with Lynx's page.
mountPage(App, { props: { title: "Inbox" } }).$destroy();
