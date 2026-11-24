// The binding's `runOnBackground` and `runOnMainThread` in a main-thread function are known by
// their import, under any name: never captured, and the function handed to `runOnBackground` is the
// background's. An import of the same name from the app's own module counts, as it always has; a
// function of the script that shares the name does not; what the build cannot tell is a build error.

import { describe, expect, it } from "@rstest/core";

import { checkModule } from "../../../../src/build/checks/module-checks.ts";
import { APP_ROOT, inApp } from "../app.ts";
import { compileScript } from "../compiling.ts";
import { readOutput, registrationsOf } from "./output.ts";

/** A script compiled for one thread, with the registrations the main thread's copy ends with. */
const compile = (source: string, thread: "background" | "main-thread", development = false) => {
	const result = compileScript(source, { thread, development });
	return { ...result, registrations: registrationsOf(result.code) };
};

/** What the background's copy of each main-thread function captures and hands the background. */
const objects = (source: string) =>
	readOutput(compile(source, "background").code).functions.map(
		({ captures, backgroundFunctions }) => ({ captures, backgroundFunctions }),
	);

/** The code of the build error compiling `source` throws, or "" when it throws none. */
function failure(source: string): string {
	try {
		compile(source, "background");
		return "";
	} catch (error) {
		return /^https:\/\/sohedra\.com\/e\/(\w+)$/m.exec((error as Error).message)?.[1] ?? "";
	}
}

/** A main-thread function that hands `save` to `call` and calls the function it gets. */
const handing = (imports: string, call: string): string => `${imports}
const save = (value) => {};
const scale = 2;
export function onTap(event) {
  "main thread";
  ${call}(save)(event.detail.x * scale);
}`;

describe("the binding's runOnBackground in a main-thread function", () => {
	it("under another name: the alias is not captured, and the function it is handed is the background's", () => {
		const source = handing(
			'import { runOnBackground as toBackground } from "@sohedra/lynx";',
			"toBackground",
		);
		expect(objects(source)).toEqual([{ captures: ["scale"], backgroundFunctions: 1 }]);
		expect(compile(source, "main-thread").registrations).toContain(
			"toBackground(_jsFn1)(event.detail.x * scale);",
		);
	});

	it("from a namespace import: the namespace is not captured", () => {
		const source = `${handing('import * as sohedra from "@sohedra/lynx";', "sohedra.runOnBackground")}
export function later() {
  "main thread";
  return sohedra.runOnMainThread(onTap);
}`;
		expect(objects(source)).toEqual([
			{ captures: ["scale"], backgroundFunctions: 1 },
			{ captures: ["onTap"], backgroundFunctions: 0 },
		]);
		const { registrations } = compile(source, "main-thread");
		expect(registrations).toContain("sohedra.runOnBackground(_jsFn1)(event.detail.x * scale);");
		expect(registrations).toContain("return sohedra.runOnMainThread(onTap);");
	});

	it("from a namespace import, read optionally or by a written-out key: the same", () => {
		for (const call of ["sohedra?.runOnBackground", 'sohedra["runOnBackground"]'])
			expect(objects(handing('import * as sohedra from "@sohedra/lynx";', call)), call).toEqual([
				{ captures: ["scale"], backgroundFunctions: 1 },
			]);
		expect(
			failure(handing('import * as threads from "$lib/threads";', 'threads["runOnBackground"]')),
		).toBe("thread_function_unclear");
	});

	it("re-exported by the app's own module under its own name: as it always was", () => {
		const source = handing('import { runOnBackground } from "$lib/threads";', "runOnBackground");
		expect(objects(source)).toEqual([{ captures: ["scale"], backgroundFunctions: 1 }]);
	});

	it("shadowed by a parameter or a function of the script: that one is a plain value, captured", () => {
		const parameter = `import { runOnBackground } from "@sohedra/lynx";
const save = () => {};
export function make() {
  return (runOnBackground) => {
    "main thread";
    runOnBackground(save);
  };
}`;
		expect(objects(parameter)).toEqual([{ captures: ["save"], backgroundFunctions: 0 }]);
		const local = handing("function runOnBackground(fn) { return fn; }", "runOnBackground");
		expect(objects(local)).toEqual([
			{ captures: ["runOnBackground", "save", "scale"], backgroundFunctions: 0 },
		]);
	});

	it("is a build error where the build cannot tell it is the binding's", () => {
		expect(failure(handing('import runOnBackground from "$lib/threads";', "runOnBackground"))).toBe(
			"thread_function_unclear",
		);
		expect(
			failure(handing('import runOnBackground from "@sohedra/lynx";', "runOnBackground")),
		).toBe("thread_function_unclear");
		expect(
			failure(
				handing('import { runOnBackground as toBackground } from "$lib/threads";', "toBackground"),
			),
		).toBe("thread_function_unclear");
		expect(
			failure(
				handing('import { save as runOnBackground } from "$lib/threads";', "runOnBackground"),
			),
		).toBe("thread_function_unclear");
		expect(
			failure(handing('import * as threads from "$lib/threads";', "threads.runOnBackground")),
		).toBe("thread_function_unclear");
	});

	it("is no error outside a main-thread function, where nothing is captured", () => {
		const source = `import runOnBackground from "$lib/threads";
export const later = () => runOnBackground(() => {});
export function onTap() {
  "main thread";
}`;
		expect(failure(source)).toBe("");
	});
});

describe("the binding's reportError in a main-thread function", () => {
	/** The build error compiling `source` throws in a build of `mode`, as text, or "". */
	function message(source: string, development: boolean): string {
		try {
			compile(source, "background", development);
			return "";
		} catch (error) {
			return (error as Error).message;
		}
	}

	const calling = (imports: string, call: string): string => `${imports}
export function onTap() {
  "main thread";
  ${call}(new Error("tap failed"));
}`;

	it("through a plain import: a build error in development and production, which says to import it as shared", () => {
		const source = calling('import { reportError } from "@sohedra/lynx";', "reportError");
		for (const development of [true, false]) {
			const text = message(source, development);
			expect(text.split("\n")[0]).toBe(
				"A main-thread function uses `reportError` of @sohedra/lynx through a plain import, which gives it the background's function: the main thread cannot run it.",
			);
			expect(text).toContain(
				'`import { reportError } from "@sohedra/lynx" with { runtime: "shared" }`',
			);
			expect(text).not.toContain("runOnBackground(reportError)");
		}
	});

	it("under another name or from a namespace, in either build: the fix names the binding's export", () => {
		for (const development of [true, false]) {
			const aliased = message(
				calling('import { reportError as report } from "@sohedra/lynx";', "report"),
				development,
			);
			expect(aliased.split("\n")[0]).toContain(
				"uses `report`, which is `reportError` of @sohedra/lynx",
			);
			expect(aliased).toContain('`import { reportError } from "@sohedra/lynx" with');
			const namespaced = message(
				calling('import * as sohedra from "@sohedra/lynx";', "sohedra.reportError"),
				development,
			);
			expect(namespaced).toContain("https://sohedra.com/e/shared_import_needed");
		}
	});

	it("handed to runOnBackground: the background's, no error", () => {
		const source = `import { reportError, runOnBackground } from "@sohedra/lynx";
export function onTap() {
  "main thread";
  runOnBackground(reportError)(new Error("tap failed"));
}`;
		expect(failure(source)).toBe("");
	});

	it("through a shared import: the main thread's own, not captured", () => {
		const source = `import { reportError } from "@sohedra/lynx" with { runtime: "shared" };
export function onTap() {
  "main thread";
  reportError(new Error("tap failed"));
}`;
		expect(objects(source)).toEqual([{ captures: [], backgroundFunctions: 0 }]);
	});
});

describe("the checks of the app's code", () => {
	/** The codes a module's checks report, in order. */
	function codesOf(text: string): string[] {
		try {
			checkModule({ file: inApp("shape.ts"), text }, APP_ROOT);
			return [];
		} catch (error) {
			return [...(error as Error).message.matchAll(/^https:\/\/sohedra\.com\/e\/(\w+)$/gm)].map(
				(match) => match[1]!,
			);
		}
	}

	/** A main-thread function that hands `call` a function using the background's APIs. */
	const background = (imports: string, call: string): string =>
		[
			imports,
			"export function onTap() {",
			"\t'main thread';",
			`\t${call}((x: unknown) => NativeModules.Log.write(x))(1);`,
			"}",
		].join("\n");

	it("read the function handed to an aliased or namespaced runOnBackground as the background's", () => {
		expect(
			codesOf(
				background(
					'import { runOnBackground as toBackground } from "@sohedra/lynx";',
					"toBackground",
				),
			),
		).toEqual([]);
		expect(
			codesOf(background('import * as sohedra from "@sohedra/lynx";', "sohedra.runOnBackground")),
		).toEqual([]);
	});

	it("read a function of the script named runOnBackground as a plain function", () => {
		expect(
			codesOf(background("function runOnBackground(fn: unknown) {}", "runOnBackground")),
		).toEqual(["background_api_on_main_thread", "plain_function_in_main_thread_function"]);
	});
});
