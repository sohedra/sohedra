// Checked by `pnpm check`, not run. `mountPage`'s `onError` gets an `Error` and where it came from:
// the thread, the component and the binding's code, each known or `undefined`.

import { mountPage } from "@sohedra/lynx";
import type { ErrorContext, ErrorHandler } from "@sohedra/lynx";
import type { Component } from "svelte";

declare const App: Component<{ title: string }>;
declare function send(report: { message: string; thread: string; where?: string }): void;

mountPage(App, {
	props: { title: "Inbox" },
	onError(error, { thread, component, code }) {
		const named: "background" | "main-thread" = thread;
		send({ message: error.message, thread: named, ...(component && { where: component }) });
		if (code === "hydration_mismatch") send({ message: "first frame redrawn", thread });
	},
});

const context: ErrorContext = { thread: "main-thread", component: undefined, code: undefined };
void context;
// A handler written apart, as a crash reporter exports it.
const reporter: ErrorHandler = (error, { thread }) => send({ message: error.message, thread });
mountPage(App, { props: { title: "Inbox" }, onError: reporter });

// @ts-expect-error a thread is one of the two.
const wrong: ErrorContext = { thread: "ui", component: undefined, code: undefined };
void wrong;
// @ts-expect-error onError gets an Error, not any value.
mountPage(App, { props: { title: "Inbox" }, onError: (error: string) => void error });
