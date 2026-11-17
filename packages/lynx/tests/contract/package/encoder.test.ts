// The encoder this package pins decides which engine versions it can build for. `engineVersion`'s
// bounds are checked against what the encoder itself accepts, so raising the pin without raising
// the bound (or the other way round) fails here, not in a user's build.

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "@rstest/core";

import { TOO_OLD } from "../../../src/build/plugin/encoder.ts";
import {
	MAX_ENGINE_VERSION,
	MIN_ENGINE_VERSION,
} from "../../../src/build/plugin/engine-version.ts";

type Encode = (options: object, debug: boolean) => Promise<{ status: number; error_msg?: string }>;

/** Encode an empty page for the engine `version`, as the template plugin does; the message when the encoder refuses. */
async function refusal(version: string): Promise<string | undefined> {
	const { getEncodeMode } = (await import(
		pathToFileURL(createRequire(import.meta.url).resolve("@lynx-js/tasm")).href
	)) as { getEncodeMode: () => Encode };
	try {
		const result = await getEncodeMode()(
			{
				compilerOptions: {
					targetSdkVersion: version,
					enableFiberArch: true,
					enableCSSSelector: true,
				},
				sourceContent: { dsl: "react_nodiff", appType: "card", config: { lepusStrict: true } },
				manifest: {},
				lepusCode: { root: undefined, lepusChunk: {} },
				customSections: {},
				css: { cssMap: {}, cssSource: {} },
			},
			false,
		);
		return result.status === 0 ? undefined : String(result.error_msg);
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
}

/** The next patch and the next minor after `version` (`major.minor`). */
function after(version: string): { patch: string; minor: string } {
	const [major = 0, minor = 0] = version.split(".").map(Number);
	return { patch: `${major}.${minor}.1`, minor: `${major}.${minor + 1}` };
}

describe("the pinned encoder", () => {
	it("encodes for the oldest and the newest engine version the plugin takes", async () => {
		expect(await refusal(MIN_ENGINE_VERSION)).toBeUndefined();
		expect(await refusal(MAX_ENGINE_VERSION)).toBeUndefined();
		expect(await refusal(`${MAX_ENGINE_VERSION}.0`)).toBeUndefined();
	});

	it("refuses the next patch and the next minor after the newest, in the words the plugin rewrites", async () => {
		const next = after(MAX_ENGINE_VERSION);
		for (const version of [next.patch, next.minor]) {
			const message = await refusal(version);
			expect(message, version).toMatch(TOO_OLD);
		}
	});
});
