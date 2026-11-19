// Checked by `pnpm check`, not run. `mount` takes Svelte's options but the renderer, which is always
// the page's, and transitions, which Lynx has none of; `unmount` returns nothing.

import { mount, root, unmount } from "@sohedra/lynx";
import type { MountOptions } from "@sohedra/lynx";
import type { LynxNode } from "@sohedra/lynx/elements";
import type { Component } from "svelte";

declare const Sheet: Component<{ label: string }, { close(): void }>;
declare const Plain: Component<{ label?: string }>;
declare const node: LynxNode<"view">;

const sheet = mount(Sheet, { props: { label: "x" } });
sheet.close();
mount(Sheet, { props: { label: "x" }, context: new Map(), target: node, anchor: node });
mount(Sheet, { props: { label: "x" }, target: root });
mount(Plain);
const options: MountOptions<{ label?: string }> = { props: { label: "x" } };
mount(Plain, options);
// @ts-expect-error unmount returns nothing: it is done when it returns.
unmount(sheet).then(() => {});

// @ts-expect-error the target is a node, not a selector.
mount(Plain, { target: "#sheet" });
// @ts-expect-error this component has a required prop.
mount(Sheet);
// @ts-expect-error the renderer is always the page's.
mount(Sheet, { props: { label: "x" }, renderer: {} });
// @ts-expect-error Lynx has no transitions to play in.
mount(Sheet, { props: { label: "x" }, intro: true });
// @ts-expect-error a prop the component does not have.
mount(Sheet, { props: { label: "x", nope: 1 } });
// @ts-expect-error unmount takes no options: it is synchronous, with no outro.
unmount(sheet, { outro: true });
