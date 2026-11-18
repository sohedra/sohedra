// The rules this package's own lint config carries over from what was once the root's: oxlint reads
// a nested config's globs, and those it extends, from the package's folder, so a root glob such as
// `packages/*/src/**` would never reach these files.

import { describe, expect, it } from "@rstest/core";

import { lint, reported } from "./lint-fixture.ts";

describe("package-wide rules", () => {
	const problems = lint({
		"packages/lynx/src/wire/probe-console.ts": 'console.log("a");\nexport {};\n',
		"packages/lynx/tests/unit/probe-console.test.ts":
			'import { expect, it } from "@rstest/core";\nit("logs", () => {\n\tconsole.log("a");\n\texpect(1).toBe(1);\n});\n',
		"packages/lynx/tests/types/probe-types.test.ts":
			'import { it } from "vitest";\nit("compiles", () => {});\n',
		"packages/lynx/tests/unit/probe-empty.test.ts":
			'import { it } from "vitest";\nit("asserts nothing", () => {});\n',
	});
	const console = reported(problems, "eslint(no-console)");
	const noAssertion = reported(problems, "vitest(expect-expect)");

	it("refuses console in src", () => {
		expect(console.has("packages/lynx/src/wire/probe-console.ts")).toBe(true);
	});

	it("allows console in tests", () => {
		expect(console.has("packages/lynx/tests/unit/probe-console.test.ts")).toBe(false);
	});

	// The vitest plugin knows a test by an import from `vitest`, so the probes import from it.
	it("lets a type test assert nothing at runtime, and no other test", () => {
		expect(noAssertion.has("packages/lynx/tests/types/probe-types.test.ts")).toBe(false);
		expect(noAssertion.has("packages/lynx/tests/unit/probe-empty.test.ts")).toBe(true);
	});
});
