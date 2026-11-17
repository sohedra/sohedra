// The engine version the bundle runs on: Lynx 4.2 is the oldest @sohedra/lynx builds for, and the
// newest is the one its encoder encodes for.

import { describe, expect, it } from "@rstest/core";

import { pluginSvelteLynx } from "../../../../src/build/plugin/index.ts";
import { checkPluginOptions } from "../../../../src/build/plugin/option-checks.ts";

/** What the options say, as the lines of the first message; empty when they pass. */
function said(engineVersion: string): string[] {
	try {
		checkPluginOptions({ engineVersion });
	} catch (error) {
		return (error as Error).message.split("\n");
	}
	return [];
}

describe("engineVersion", () => {
	it("takes 4.2 up to the encoder's newest, as the encoder takes it: by the whole version", () => {
		for (const version of ["4.2", "4.2.0", "4.2.7", "4.3", "4.3.0"])
			expect(said(version), version).toEqual([]);
	});

	it("is refused when older than 4.2, with the one value to use", () => {
		for (const version of ["3.9", "3.10", "4.1", "2.18", "4.0.9"]) {
			const [sentence, , fix] = said(version);
			expect(sentence, version).toBe(
				`\`engineVersion\` is '${version}', and @sohedra/lynx builds for Lynx 4.2 and later.`,
			);
			expect(fix, version).toBe("Use '4.2' or later, or leave the option out for '4.2'.");
		}
	});

	it("is refused when newer than the encoder encodes for, with its own message", () => {
		for (const version of ["4.3.1", "4.4", "4.10", "5", "5.0"]) {
			const [sentence, , fix] = said(version);
			expect(sentence, version).toBe(
				`\`engineVersion\` is '${version}', and the encoder of @sohedra/lynx encodes for Lynx 4.3 at most.`,
			);
			expect(fix, version).toBe("Use '4.3' or earlier, or update @sohedra/lynx.");
		}
	});

	it("is refused by pluginSvelteLynx() itself, when the plugin is made", () => {
		expect(() => pluginSvelteLynx({ engineVersion: "3.9" })).toThrow(/Lynx 4\.2 and later/);
		expect(() => pluginSvelteLynx({ engineVersion: "5.0" })).toThrow(/Lynx 4\.3 at most/);
		for (const version of ["4.2", "4.3"])
			expect(() => pluginSvelteLynx({ engineVersion: version }), version).not.toThrow();
	});
});
