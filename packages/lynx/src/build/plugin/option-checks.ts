// The checks of `pluginSvelteLynx()`'s options, made when the plugin is made: one error lists
// every mistake, each with its fix and docs link.

import { buildErrors } from "../diagnostics/messages.ts";
import type { AnyReport } from "../diagnostics/messages.ts";
import { engineVersionRange, MAX_ENGINE_VERSION, MIN_ENGINE_VERSION } from "./engine-version.ts";
import { PLUGIN_OPTION_NAMES } from "./option-names.ts";
import { FORCED_PAGE_CONFIG } from "./page-config.ts";
import { PLUGIN_DEFINE_KEYS } from "./thread-defines.ts";

/** What a check says it was given: JSON, or "a function". */
function given(value: unknown): string {
	return typeof value === "function" ? "a function" : (JSON.stringify(value) ?? String(value));
}

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** The known name within edit distance 2 of `name`, or differing only in case. */
function closest(name: string): string | undefined {
	let best: string | undefined;
	let bestDistance = 3;
	for (const candidate of PLUGIN_OPTION_NAMES) {
		const distance =
			candidate.toLowerCase() === name.toLowerCase() ? 0 : editDistance(name, candidate);
		if (distance < bestDistance) {
			best = candidate;
			bestDistance = distance;
		}
	}
	return best;
}

function editDistance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i++) {
		let diagonal = row[0]!;
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const above = row[j]!;
			row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
			diagonal = above;
		}
	}
	return row[b.length]!;
}

/** The report for an unknown option, called by its `name`. */
function unknownOption(name: string, label: string = name): AnyReport {
	return { code: "unknown_plugin_option", details: { name: label, suggestion: closest(name) } };
}

const wrongType = (name: string, expected: string, value: unknown): AnyReport => ({
	code: "plugin_option_type",
	details: { name, expected, given: given(value) },
});

function engineVersionProblems(value: unknown): AnyReport[] {
	if (typeof value !== "string")
		return [wrongType("engineVersion", "a version string such as '4.2'", value)];
	switch (engineVersionRange(value)) {
		case "old":
			return [
				{ code: "engine_version_old", details: { version: value, minimum: MIN_ENGINE_VERSION } },
			];
		case "new":
			return [
				{ code: "engine_version_new", details: { version: value, maximum: MAX_ENGINE_VERSION } },
			];
		default:
			return [];
	}
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

function defineProblems(define: unknown): AnyReport[] {
	if (!isObject(define))
		return [wrongType("define", "an object with `mainThread` and `background`", define)];
	const found: AnyReport[] = [];
	for (const [thread, constants] of Object.entries(define)) {
		if (constants === undefined) continue;
		if (thread !== "mainThread" && thread !== "background") {
			found.push({ code: "define_thread_unknown", details: { name: `define.${thread}` } });
		} else if (!isObject(constants)) {
			found.push(wrongType(`define.${thread}`, "an object of constants", constants));
		} else {
			for (const [key, value] of Object.entries(constants)) {
				const name = `define.${thread}.${key}`;
				if (PLUGIN_DEFINE_KEYS.includes(key))
					found.push({ code: "define_key_reserved", details: { name } });
				else if (!IDENTIFIER.test(key))
					found.push({ code: "define_key_invalid", details: { name } });
				else if (value !== null && !["string", "number", "boolean"].includes(typeof value))
					found.push(wrongType(name, "a string, a number, a boolean or null", value));
			}
		}
	}
	return found;
}

/** A package's name: `zustand`, `@acme/state`; not a path into it, nor a file. */
const PACKAGE_NAME = /^(?:@[\w~][\w.~-]*\/)?[\w~][\w.~-]*$/;

function singleCopyProblems(value: unknown): AnyReport[] {
	if (
		Array.isArray(value) &&
		value.every((name) => typeof name === "string" && PACKAGE_NAME.test(name))
	)
		return [];
	return [{ code: "single_copy_name", details: { given: given(value) } }];
}

const isPageConfigValue = (value: unknown): boolean =>
	typeof value === "boolean" ||
	typeof value === "string" ||
	(typeof value === "number" && Number.isFinite(value)) ||
	(Array.isArray(value) && value.every((item) => typeof item === "string"));

function pageConfigProblems(pageConfig: unknown): AnyReport[] {
	if (!isObject(pageConfig))
		return [wrongType("pageConfig", "an object of page-config keys", pageConfig)];
	const found: AnyReport[] = [];
	for (const [key, value] of Object.entries(pageConfig)) {
		if (value === undefined) continue;
		if (FORCED_PAGE_CONFIG.includes(key))
			found.push({ code: "page_config_reserved", details: { key } });
		else if (!isPageConfigValue(value))
			found.push(
				wrongType(`pageConfig.${key}`, "a boolean, a number, a string or a list of strings", value),
			);
	}
	return found;
}

function svelteProblems(svelte: unknown): AnyReport[] {
	if (!isObject(svelte)) return [wrongType("svelte", "an object such as { configFile }", svelte)];
	const found: AnyReport[] = [];
	for (const [key, value] of Object.entries(svelte)) {
		if (key !== "configFile") found.push(unknownOption(key, `svelte.${key}`));
		else if (value !== undefined && typeof value !== "string")
			found.push(wrongType("svelte.configFile", "a path", value));
	}
	return found;
}

/**
 * Throw one error listing every mistake in `options`: unknown options first, then
 * each option's own, in the order the docs list them.
 */
export function checkPluginOptions(options: object): void {
	// Boundary: the options of a user are read by name, whatever their type.
	const given = options as Record<string, unknown>;
	const found: AnyReport[] = Object.keys(options)
		.filter((name) => !PLUGIN_OPTION_NAMES.includes(name))
		.map((name) => unknownOption(name));
	const has = (name: string): boolean => given[name] !== undefined;

	if (has("engineVersion")) found.push(...engineVersionProblems(given["engineVersion"]));
	if (
		has("firstFrame") &&
		typeof given["firstFrame"] !== "boolean" &&
		typeof given["firstFrame"] !== "function"
	)
		found.push(
			wrongType(
				"firstFrame",
				"a boolean or a function of the entry's name that returns one",
				given["firstFrame"],
			),
		);
	if (has("define")) found.push(...defineProblems(given["define"]));
	if (has("singleCopy")) found.push(...singleCopyProblems(given["singleCopy"]));
	if (has("pageConfig")) found.push(...pageConfigProblems(given["pageConfig"]));
	if (has("svelte")) found.push(...svelteProblems(given["svelte"]));

	const [first, ...rest] = found;
	if (first !== undefined) throw buildErrors([first, ...rest]);
}
