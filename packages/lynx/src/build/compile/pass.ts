// A pass of the compile step reads the component's one syntax tree and returns edits against the
// text as written. The edits of every pass are applied together, once, so a pass never sees
// another's output, and every position it reports is the author's.

import type { ComponentAst } from "../../svelte/build/index.ts";
import type { Thread } from "../../wire/index.ts";
import type { ModuleFills } from "../checks/fills-store.ts";
import type { BuildWarning } from "../diagnostics/messages.ts";
import type { Edit } from "../source-map/edits.ts";

/** What a pass reads. */
export interface PassContext {
	/** The component as written, after its preprocessors. */
	source: string;
	filename: string;
	/** The component's syntax tree, parsed once from `source`. */
	ast: ComponentAst;
	/** The thread this copy of the component is for. */
	thread: Thread;
	/** A development build. */
	development: boolean;
	/**
	 * The module this thread's copy imports Svelte's runtime from, the binding's own; none when the
	 * build gives none, and the component runs on Svelte's.
	 */
	internals?: string | undefined;
	/** The module of the custom renderer, which background components import. */
	renderer?: string | undefined;
	/** The app's folder, which the places a thread's runtime reports are made relative to. */
	root?: string | undefined;
	/**
	 * Check the component as the app's own code: the reads that fail on Lynx, its selectors, its
	 * main-thread handlers. Only the background's copy checks, so each place is reported once.
	 */
	checks?: boolean | undefined;
	/** The warnings the passes add. */
	warnings: BuildWarning[];
	/** The reads that wait on a fill, and the fills the component imports. */
	fills: ModuleFills;
}

/** A pass: the edits it makes, or an error it throws, for a component. */
export type Pass = (context: PassContext) => Edit[];
