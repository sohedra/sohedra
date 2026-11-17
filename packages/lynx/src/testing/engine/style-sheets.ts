// Style sheets a lazy bundle brings: the page loads one by its bundle's name and adopts it
// (core/runtime/lepus/bindings/renderer_functions.cc, LoadStyleSheet and AdoptStyleSheet). A test
// provides the sheets; the engine fake does not read a bundle.

import { argumentError } from "./state.ts";

/** The functions that load and adopt style sheets. */
export interface StyleSheetFunctions {
	__LoadStyleSheet(section: string, bundleName: string): unknown;
	__AdoptStyleSheet(sheet: unknown): void;
}

/** What a test does with style sheets. */
export interface StyleSheets {
	/** The sheet `__LoadStyleSheet` finds for a bundle. */
	provide(bundleName: string, sheet: unknown): void;
	/** The sheets the page adopted, in order. */
	readonly adopted: unknown[];
}

/** The style sheet functions and what a test does with them. */
export function createStyleSheets(): {
	functions: StyleSheetFunctions;
	sheets: StyleSheets;
} {
	const provided = new Map<string, unknown>();
	const adopted: unknown[] = [];
	return {
		functions: {
			__LoadStyleSheet(section, bundleName) {
				if (typeof section !== "string") throw argumentError("__LoadStyleSheet", 0, "text");
				if (typeof bundleName !== "string") throw argumentError("__LoadStyleSheet", 1, "text");
				// The engine answers nothing for a bundle it does not have.
				return provided.get(bundleName);
			},
			__AdoptStyleSheet(sheet) {
				// Only a sheet the engine loaded is one it can adopt.
				if ([...provided.values()].includes(sheet)) adopted.push(sheet);
			},
		},
		sheets: { provide: (bundleName, sheet) => void provided.set(bundleName, sheet), adopted },
	};
}
