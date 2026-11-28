// The word list of contributing/code.md § Names, on the type, interface and class names the
// primitives declare: `…State` names only a part's public state, and no name ends in a word the
// list leaves out (`…Intent`, `…ContextValue`, `…Config`, `…Manager` and the rest).
//
//   node scripts/primitives-names.ts

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { codeText } from "./code-text.ts";
import { type Finding, unexempted } from "./exemptions.ts";
import { PRIMITIVES } from "./primitives-layout.ts";
import { sourceFiles } from "./source-files.ts";

/** Endings the word list leaves out, each with what to use instead. */
export const BANNED_ENDINGS: Record<string, string> = {
	Intent: "a `…Store` for state, an intent for a change",
	ContextValue: "a context holds a store or a `…View`",
	Config: "`…Props` and `…Deps` for a store or building block, `…Options` for a call",
	Manager: "name what it holds or decides",
	Facts: "a fact is a plain value: name it for what it is",
	Host: "`Platform` is what core gets from where it runs",
	Scope: "a context holds a store or a `…View`",
	Helper: "name the idea",
	Util: "name the idea",
	Utils: "name the idea",
};
const DECLARATION =
	/^\s*(?:export\s+)?(?:declare\s+)?(?:abstract\s+)?(?:(?:interface|class|enum)\s+([A-Z]\w*)|type\s+([A-Z]\w*)\s*(?:<[^=]*>)?\s*=)/gm;

/**
 * Names the word list allows by reason, keyed `<file>#<name>`: the state of a shared part, which no
 * component's parts list holds. "todo:" marks a name to change.
 */
const EXEMPTIONS: Record<string, string> = {
	"packages/primitives-core/src/foundation/position/position-types.ts#AnchoredPositionerState":
		"The public state of the shared part AnchoredPositioner, which each popup's Positioner renders.",
	"packages/primitives-core/src/foundation/position/position-types.ts#AnchoredPopupState":
		"The public state of a popup element placed by AnchoredPositioner, shared by every popup's Popup.",
	"packages/primitives-core/src/foundation/position/position-types.ts#AnchoredArrowState":
		"The public state of the shared part AnchoredArrow.",
	"packages/primitives-core/src/foundation/position/position-types.ts#AnchoredViewportState":
		"The public state of the shared part AnchoredViewport.",
	"packages/primitives-core/src/foundation/popup/popup-types.ts#PopupPortalState":
		"The public state of the shared part PopupPortal.",
	"packages/primitives-core/src/foundation/popup/popup-types.ts#PopupTriggerState":
		"The public state every popup's Trigger renders, built by PopupTriggerStore.",
	"packages/primitives-core/src/foundation/form/form-types.ts#FieldRootState":
		"Field.Root's public state, which a control in a Field reads; the Field family brings the part.",
};

/** Where a declared name in the primitives packages of `root` breaks the word list. */
export function checkPrimitivesNames(root: string): string[] {
	const findings: Finding[] = [];
	for (const pkg of PRIMITIVES) {
		const src = join(root, "packages", pkg, "src");
		if (!existsSync(src)) continue;
		const parts = partNames(root);
		for (const { file, path } of sourceFiles(root, { under: src, names: /\.(?:ts|svelte)$/ })) {
			const { code } = codeText(readFileSync(path, "utf8"), file, { strings: true });
			for (const match of code.matchAll(DECLARATION)) {
				const name = match[1] ?? match[2]!;
				const key = `${file}#${name}`;
				const ending = Object.keys(BANNED_ENDINGS).find((word) => name.endsWith(word));
				if (ending !== undefined) {
					findings.push({
						key,
						message: `${file}: ${name} ends in "${ending}", which the word list leaves out: ${BANNED_ENDINGS[ending]}.`,
					});
				}
				if (name.endsWith("State") && name !== "State" && !parts.has(name.slice(0, -5))) {
					findings.push({
						key,
						message: `${file}: ${name} isn't a part's public state (<Component><Part>State). Name a view \`…View\`, constructor inputs \`…Props\`/\`…Deps\`, a call's options \`…Options\`.`,
					});
				}
			}
		}
	}
	return unexempted(findings, EXEMPTIONS, "scripts/primitives-names.ts");
}

/** Every `<Component><Part>` the platform packages render, from their part files. */
function partNames(root: string): Set<string> {
	const names = new Set<string>();
	const pascal = (kebab: string): string =>
		kebab.replace(/(?:^|-)([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
	for (const pkg of PRIMITIVES) {
		const components = join(root, "packages", pkg, "src/components");
		if (!existsSync(components)) continue;
		for (const component of readdirSync(components)) {
			const dir = join(components, component);
			if (!existsSync(dir)) continue;
			for (const file of readdirSync(dir)) {
				const part = new RegExp(`^${component}-([a-z0-9-]+)\\.svelte$`).exec(file)?.[1];
				if (part !== undefined) names.add(pascal(component) + pascal(part));
				if (file === `${component}.svelte`) names.add(pascal(component));
			}
		}
	}
	return names;
}

if (import.meta.main) {
	const problems = checkPrimitivesNames(".");
	for (const problem of problems) console.error(problem);
	process.exit(problems.length > 0 ? 1 : 0);
}
