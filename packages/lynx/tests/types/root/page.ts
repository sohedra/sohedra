// Checked by `pnpm check`, not run. `mountPage` takes the root component and its props, as an object
// or as a function of the page's data and the host's global props, typed as the app augments
// `@sohedra/lynx/host`'s `InitData` and `GlobalProps`, and a context. Props the component requires
// must be given, as `mount` requires them.

import { mountPage } from "@sohedra/lynx";
import type { MountPageOptions } from "@sohedra/lynx";
import type { GlobalProps, InitData } from "@sohedra/lynx/host";
import type { Component } from "svelte";

declare module "@sohedra/lynx/host" {
	interface InitData {
		folder?: string;
	}
	interface GlobalProps {
		unread?: number;
	}
}

declare const App: Component<{ title: string }>;
declare const Plain: Component;
// Props as Svelte's docs write them, and as svelte-check types a root component: an interface,
// which has no index signature.
interface InboxProps {
	title: string;
}
declare const Inbox: Component<InboxProps>;

mountPage(App, { props: { title: "Inbox" } });
mountPage(App, {
	props: (data, globals) => ({ title: `${String(data["title"])} ${String(globals["x"])}` }),
});
mountPage(App, { props: { title: "Inbox" }, context: new Map([["theme", "dark"]]) });
mountPage(Plain);
mountPage(Inbox, { props: { title: "Inbox" } });
mountPage(Inbox, { props: (data) => ({ title: String(data["title"]) }) });
const options = { props: { title: "Inbox" } } satisfies MountPageOptions<{ title: string }>;
mountPage(App, options);
// The app's own keys reach the function, typed.
mountPage(App, {
	props: (data, globals) => {
		const folder: string | undefined = data.folder;
		const unread: number | undefined = globals.unread;
		return { title: `${folder ?? "Inbox"} (${unread ?? 0})` };
	},
});
const fromHost = (data: InitData, globals: GlobalProps) => ({
	title: String(data.folder) + globals.unread,
});
mountPage(App, { props: fromHost });

// @ts-expect-error the component requires props, as `mount` does.
mountPage(App);
// @ts-expect-error the component requires props, as `mount` does.
mountPage(App, {});
// @ts-expect-error the component requires props, as `mount` does.
mountPage(Inbox, { context: new Map() });
// @ts-expect-error options that may hold no props do not give the component its props.
mountPage(App, {} as MountPageOptions<{ title: string }>);
// @ts-expect-error a prop the component does not have.
mountPage(App, { props: { title: "Inbox", count: 1 } });
// @ts-expect-error a prop the interface does not have.
mountPage(Inbox, { props: { title: "Inbox", count: 1 } });
// @ts-expect-error the function returns the component's props.
mountPage(App, { props: () => ({ title: 1 }) });
// @ts-expect-error an augmented key keeps its type: the folder is a string, or missing.
mountPage(App, { props: (data) => ({ title: data.folder.toFixed() }) });
// @ts-expect-error the context is a map.
mountPage(App, { props: { title: "Inbox" }, context: { theme: "dark" } });
// @ts-expect-error mountPage returns nothing to unmount: the page goes with Lynx's page.
mountPage(App, { props: { title: "Inbox" } }).$destroy();
