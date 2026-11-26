import type { ControlLabels } from "@sohedra/primitives-core/foundation/form/index.js";
import type { Attachment } from "svelte/attachments";

type LabelSource = HTMLElement & { labels?: NodeListOf<HTMLLabelElement> | null | undefined };

/**
 * Finds the native `<label>` associated with the attached element (wrapping, or linked with
 * `for`), gives it an id when it has none, and reports it as the control's fallback
 * `aria-labelledby`. It re-checks when the source id or the fallback conditions change, and while a
 * fallback is wanted, whenever a label is added or removed or a label's `for` or `id` changes in the
 * control's tree (a label mounted later).
 */
export function attachLabelFallback(labels: ControlLabels): Attachment<LabelSource> {
	return (source) => {
		// The fallback label follows the label conditions and, while one is wanted, the labels in the
		// control's tree.
		$effect(() => {
			const labelId = labels.fallbackLabelId;
			if (labelId === undefined) {
				labels.setFallback(undefined);
				return;
			}
			const check = () => labels.setFallback(getAriaLabelledBy(source, labelId));
			check();
			return observeLabels(source.getRootNode(), check);
		});
	};
}

interface LabelWatcher {
	observer: MutationObserver;
	callbacks: Set<() => void>;
}

// One observer per tree (document or shadow root), shared by every control in it: the DOM it
// watches is global to the tree.
const watchers = new WeakMap<Node, LabelWatcher>();

/** Whether a mutation adds or removes a label, or changes a label's `for` or `id`. */
function affectsLabels(record: MutationRecord): boolean {
	if (record.type === "attributes") {
		return (record.target as Element).tagName === "LABEL";
	}
	return [...record.addedNodes, ...record.removedNodes].some(containsLabel);
}

function containsLabel(node: Node): boolean {
	if (node.nodeType !== Node.ELEMENT_NODE) {
		return false;
	}
	const element = node as Element;
	return element.tagName === "LABEL" || element.querySelector("label") !== null;
}

/** Calls `callback` after a label is added or removed, or a label's `for` or `id` changes, in `root`. */
function observeLabels(root: Node, callback: () => void): () => void {
	let watcher = watchers.get(root);
	if (!watcher) {
		const callbacks = new Set<() => void>();
		const observer = new MutationObserver((records) => {
			// Most mutations can't change which label a control has: skip them without any work.
			if (!records.some(affectsLabels)) {
				return;
			}
			for (const run of Array.from(callbacks)) {
				run();
			}
		});
		observer.observe(root, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["for", "id"],
		});
		watcher = { observer, callbacks };
		watchers.set(root, watcher);
	}
	const current = watcher;
	current.callbacks.add(callback);
	return () => {
		current.callbacks.delete(callback);
		if (current.callbacks.size === 0) {
			current.observer.disconnect();
			watchers.delete(root);
		}
	};
}

function getAriaLabelledBy(source: LabelSource, generatedLabelId: string) {
	const label = findAssociatedLabel(source);
	if (!label) {
		return undefined;
	}
	if (!label.id) {
		label.id = generatedLabelId;
	}
	return label.id || undefined;
}

function findAssociatedLabel(source: LabelSource) {
	// Fast path before the expensive `.labels` read.
	const parent = source.parentElement;
	if (parent && parent.tagName === "LABEL") {
		return parent as HTMLLabelElement;
	}
	const controlId = source.id;
	if (controlId) {
		const nextSibling = source.nextElementSibling as HTMLLabelElement | null;
		if (nextSibling && nextSibling.htmlFor === controlId) {
			return nextSibling;
		}
	}
	const label = source.labels?.[0];
	if (label && (label.contains(source) || label.htmlFor === controlId)) {
		return label;
	}
	// WORKAROUND(safari): WebKit keeps a stale `labels` list after the control's id changes, so the
	// label is looked up by its `for`. Remove when WebKit updates `labels` with the id.
	if (!controlId) {
		return undefined;
	}
	const root = source.getRootNode() as Document | ShadowRoot;
	return (
		root.querySelector?.<HTMLLabelElement>(`label[for="${CSS.escape(controlId)}"]`) ?? undefined
	);
}
