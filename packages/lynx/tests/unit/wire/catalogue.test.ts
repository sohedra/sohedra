// The wire's messages: every entry has its fix and its docs page, and every message is a snapshot.

import { describe, expect, it } from "@rstest/core";

import {
	WIRE_CATALOGUE,
	WIRE_DEVELOPMENT_CATALOGUE,
	wireDevelopmentError,
	wireError,
} from "../../../src/wire/index.ts";
import type { WireCode, WireDetails } from "../../../src/wire/index.ts";
import { INTERNAL_WORDS } from "../../contract/messages/internal-words.ts";

const SAMPLES: { [Code in WireCode]: WireDetails[Code] } = {
	threads_from_different_builds: { thread: "main-thread", received: 2, expected: 1 },
	page_reloaded_on_one_thread: { thread: "main-thread", received: 2, generation: 1 },
	value_not_copyable: { thread: "main-thread", reason: "Do not know how to serialize a BigInt" },
	global_not_filled: { name: "URL", module: "@sohedra/lynx-polyfill/url", baseline: true },
	global_background_only: { name: "ReadableStream" },
	global_not_on_lynx: {
		name: "crypto",
		instead: "For hashes, use a library in plain JavaScript such as @noble/hashes.",
	},
	page_already_mounted: { thread: "main-thread" },
	page_not_started: { reason: "Cannot read properties of undefined (reading 'title')" },
};

/** Every entry: those a production build reports, and those only a development build does. */
const CATALOGUE = { ...WIRE_CATALOGUE, ...WIRE_DEVELOPMENT_CATALOGUE };
const CODES = Object.keys(CATALOGUE) as WireCode[];

/** The error for `code`, through the function its code is raised with. */
const errorOf = (code: WireCode, details: unknown): Error =>
	// The samples hold each code's own details, which TypeScript cannot pair through an index.
	code in WIRE_DEVELOPMENT_CATALOGUE
		? wireDevelopmentError({ code, details } as never)
		: wireError({ code, details } as never);

describe("the wire's catalogue", () => {
	it("has a sample for each entry", () => {
		expect(Object.keys(SAMPLES).sort()).toEqual([...CODES].sort());
	});

	it.each(CODES)("%s has a fix and its own code as its docs page", (code) => {
		const entry = CATALOGUE[code];
		// The samples hold each code's own details, which TypeScript cannot pair through an index.
		expect(entry.fix(SAMPLES[code] as never).trim()).not.toBe("");
		expect(entry.docs).toBe(code);
	});

	it.each(CODES)("%s: the message", (code) => {
		const text = errorOf(code, SAMPLES[code]).message;
		expect(text.split("\n")[0]).toMatch(/^[A-Z].*\.$/);
		expect(text).not.toMatch(INTERNAL_WORDS);
		expect(text).toMatchSnapshot();
	});
});
