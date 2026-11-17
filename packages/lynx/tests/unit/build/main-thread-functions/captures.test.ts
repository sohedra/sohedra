// What a main-thread function captures, and what the compile step writes for it: small scripts,
// one case each. The corpus (./corpus.test.ts) has whole files.

import { describe, expect, it } from "@rstest/core";

import { inApp, withoutRoot } from "../app.ts";
import { compileScript, component } from "../compiling.ts";
import { evaluate, readOutput, registrationBodies, registrationsOf } from "./output.ts";

/** A script compiled for one thread, with the registrations the main thread's copy ends with. */
const compile = (
	source: string,
	thread: "background" | "main-thread" = "main-thread",
	file = "handlers.ts",
) => {
	const result = compileScript(source, { thread, file });
	return { ...result, registrations: registrationsOf(result.code) };
};

/** The captured names of each main-thread function in `source`, in source order. */
const captures = (source: string, file?: string): string[][] =>
	readOutput(compile(source, "background", file).code).functions.map((fn) => fn.captures);

describe("what a main-thread function captures", () => {
	it("a name the file declares outside it, not one it declares itself (shadowing)", () => {
		expect(
			captures(`
        const size = 1;
        const limit = 2;
        export function onTap(event) {
          "main thread";
          const size = event.detail.size;
          return size > limit;
        }`),
		).toEqual([["limit"]]);
	});

	it("the outer name again where an inner block's declaration does not reach", () => {
		expect(
			captures(`
        const size = 1;
        export function onTap(flag) {
          "main thread";
          if (flag) {
            const size = 2;
            return size;
          }
          return size;
        }`),
		).toEqual([["size"]]);
		// A `var` in a block is the whole function's.
		expect(
			captures(`
        const size = 1;
        export function onTap(flag) {
          "main thread";
          if (flag) {
            var size = 2;
          }
          return size;
        }`),
		).toEqual([[]]);
	});

	it("an outer name read by a parameter's default", () => {
		expect(
			captures(`
        const fallback = 10;
        const scale = 2;
        export function onTap(distance = fallback, { ratio = scale } = {}) {
          "main thread";
          return distance * ratio;
        }`),
		).toEqual([["fallback", "scale"]]);
	});

	it("nothing for the names a destructuring declares, only what it reads", () => {
		expect(
			captures(`
        const settings = { size: { width: 1 } };
        const key = "depth";
        const first = 0;
        export function onTap(event) {
          "main thread";
          const { width, height: tall = first, [key]: depth, ...rest } = settings.size;
          const [head, [inner] = [], ...tail] = event.touches;
          return [width, tall, depth, rest, head, inner, tail];
        }`),
		).toEqual([["first", "key", "settings.size"]]);
	});

	it("nothing for a name used only as a type", () => {
		expect(
			captures(`
        import type { MainThread } from "@lynx-js/types";
        import { type Point, origin } from "./geometry.ts";
        interface Size { width: number }
        type Scale = number;
        const scale: Scale = 2;
        const size: Size = { width: 1 };
        export function onTap(event: MainThread.TouchEvent, at: Point = origin): Size {
          "main thread";
          type Local = typeof size;
          const next = { width: scale } as Local satisfies Size;
          return <Size>next!;
        }`),
		).toEqual([["origin", "scale"]]);
	});

	it("nothing for a catch clause's parameter, but the outer name of the same name after it", () => {
		expect(
			captures(`
        const error = "outer";
        const message = "outer";
        const report = (value) => value;
        export function onTap() {
          "main thread";
          try {
            report(1);
          } catch (error) {
            report(error);
          }
          try {
            report(2);
          } catch ({ message }) {
            report(message);
          }
          return error;
        }`),
		).toEqual([["report", "error"]]);
	});

	it("a function or a variable declared later in the file", () => {
		expect(
			captures(`
        export function onTap() {
          "main thread";
          return [later(), after, Shape];
        }
        function later() {}
        const after = 1;
        class Shape {}`),
		).toEqual([["later", "after", "Shape"]]);
	});

	it("an import, whichever way it was imported", () => {
		expect(
			captures(`
        import theme, { limit, size as width } from "./theme.ts";
        import * as easing from "./easing.ts";
        export function onTap() {
          "main thread";
          return [theme, limit, width, easing.linear];
        }`),
		).toEqual([["theme", "limit", "width", "easing.linear"]]);
	});

	it("no global: a name the file does not declare, or only declares with `declare`", () => {
		expect(
			captures(`
        declare const nativeBridge: { call(): void };
        declare function ambient(): void;
        export function onTap() {
          "main thread";
          console.log(Math.max(1, 2), undefined, typeof somewhere);
          setTimeout(() => lynx.querySelector(".box"), SystemInfo.pixelRatio);
          nativeBridge.call();
          ambient();
          return __DEV__ ? arguments.length : globalThis.elsewhere;
        }`),
		).toEqual([[]]);
	});

	it("what a main-thread function inside it reads, which is part of its body", () => {
		const source = `
        const outer = 1;
        const inner = 2;
        export function onTap() {
          "main thread";
          const again = () => {
            "main thread";
            return inner;
          };
          return [outer, again];
        }`;
		const output = compile(source);
		expect(readOutput(output.code).functions.map((fn) => fn.captures)).toEqual([
			["inner", "outer"],
		]);
		expect(output.ids).toHaveLength(1);
		// The inner one is left as written.
		expect(output.registrations).toContain(`const again = () => {\n            "main thread";`);
	});

	it("the function a main-thread function is made in: its parameters and variables", () => {
		expect(
			captures(`
        const shared = 1;
        export function make(callback, { id }) {
          const local = 2;
          return (event) => {
            "main thread";
            return callback(event, id, local, shared);
          };
        }`),
		).toEqual([["callback", "id", "local", "shared"]]);
	});

	it("of an object read member by member, only those members", () => {
		expect(
			captures(`
        const settings = { size: { width: 1, height: 2 }, names: {} };
        const box = { current: null };
        const key = "a";
        export function onTap() {
          "main thread";
          box.current?.setStyleProperty("width", settings.size.width);
          return [settings.size.height, settings.names[key], settings["a-b"]?.c];
        }`),
		).toEqual([
			[
				"box",
				"settings.size.width",
				"settings.size.height",
				"settings.names",
				"settings.a-b",
				"key",
			],
		]);
		// Read whole anywhere, it is captured whole.
		expect(
			captures(`
        const settings = { size: { width: 1 } };
        export function onTap() {
          "main thread";
          return [settings.size.width, settings];
        }`),
		).toEqual([["settings"]]);
	});

	// `a?.b` must not capture `a.b`: that reads `a.b` when the function is made,
	// and throws on the background where the written code would not. The object
	// before the `?.` is captured instead, and the body keeps the `?.`.
	describe("an optional chain: captured up to the `?.`, so that capturing never throws where the code would not", () => {
		/** What `expression` gives, or that it threw. */
		const outcome = (run: () => unknown): { value: unknown } | { threw: true } => {
			try {
				return { value: run() };
			} catch {
				return { threw: true };
			}
		};

		/**
		 * The function as written, and as the build makes it: made on the background, sent across
		 * (which keeps only what JSON keeps), and run on the main thread.
		 */
		function both(setup: string, expression: string) {
			const source = `${setup}\nexport function f() {\n  "main thread";\n  return ${expression};\n}\n`;
			const written = outcome(() => evaluate(`${setup}\nreturn (${expression});`));
			const background = compile(source, "background");
			const mainThread = compile(source, "main-thread");
			const run = outcome(() => {
				const made = evaluate(`${background.code.replace("export ", "")}\nreturn f;`);
				const object: unknown = JSON.parse(JSON.stringify(made));
				let body: ((this: unknown) => unknown) | undefined;
				evaluate(registrationBodies(mainThread.code), {
					registerWorkletInternal: (_: string, __: string, fn: typeof body) => (body = fn),
				});
				return body!.call(object);
			});
			return { written, run, background, mainThread };
		}

		const forms: [string, string[]][] = [
			["a?.b", ["null", "undefined", "{ b: 1 }", "{}"]],
			["a?.b.c", ["null", "undefined", "{ b: { c: 1 } }"]],
			["a.b?.c", ["{ b: null }", "{ b: undefined }", "{ b: { c: 1 } }"]],
			["a?.[key]", ["null", "undefined", "{ k: 1 }"]],
			["a?.[key].c", ["null", "{ k: { c: 1 } }"]],
			['a?.["b"]', ["null", "undefined", "{ b: 1 }"]],
			// A method does not survive the trip: only the forms that do not call it are claimed here.
			["a?.b()", ["null", "undefined"]],
			["a.b?.()", ["{ b: null }", "{ b: undefined }"]],
			["settings.size?.width", ["{ size: null }", "{ size: { width: 3 } }"]],
		];

		for (const [expression, values] of forms) {
			it(`${expression}: the body reads what the written code reads`, () => {
				for (const value of values) {
					const name = expression.startsWith("settings") ? "settings" : "a";
					const { written, run } = both(`const ${name} = ${value};\nconst key = "k";`, expression);
					// Where the written code does not throw, nor does making the function or running it.
					expect({ value, outcome: run }).toEqual({ value, outcome: written });
				}
			});
		}

		it("captures the object before the `?.` and narrows no further", () => {
			expect(
				captures(`
          const a = {};
          const key = "k";
          const settings = {};
          const t = {};
          export function onTap() {
            "main thread";
            return [a?.b, t?.u.v, settings.size?.width, a?.[key]];
          }`),
			).toEqual([["a", "t", "settings.size", "key"]]);
			expect(
				captures(`const a = {};\nexport function f() {\n  "main thread";\n  return a?.b();\n}`),
			).toEqual([["a"]]);
		});

		it("gives both threads the same id and the same captured shape", () => {
			const { background, mainThread } = both(
				"const a = null;\nconst key = 'k';",
				"[a?.b.c, a?.[key]]",
			);
			expect(mainThread.ids).toEqual(background.ids);
			expect(readOutput(mainThread.code).functions).toEqual(readOutput(background.code).functions);
			expect(readOutput(background.code).functions[0]!.captures).toEqual(["a", "key"]);
		});
	});

	it("not itself: it calls itself by its own name", () => {
		const output = compile(`
        const limit = 3;
        export function count(n) {
          "main thread";
          return n < limit ? count(n + 1) : n;
        }`);
		expect(readOutput(output.code).functions.map((fn) => fn.captures)).toEqual([["limit"]]);
		expect(output.registrations).toMatch(
			/function __mainThreadFunction\(n\) \{\nconst count = __mainThreadFunction\.bind\(this\);\nlet \{ limit \} = this\["_c"\];/,
		);
	});

	it("not runOnBackground or runOnMainThread, nor the function handed to runOnBackground", () => {
		const source = `
        import { runOnBackground, runOnMainThread } from "@sohedra/lynx";
        const store = { save(value) {} };
        const other = () => {};
        const scale = 2;
        export function onTap(event) {
          "main thread";
          runOnBackground(store.save)(event.detail.x * scale);
          return runOnMainThread(other);
        }`;
		const [background] = readOutput(compile(source, "background").code).functions;
		expect(background).toMatchObject({ captures: ["scale", "other"], backgroundFunctions: 1 });
		expect(compile(source, "background").code).toMatch(
			/_jsFn: \{ _jsFn1: __transformToWorklet_\w+\(store\.save\) \}/,
		);
		const mainThread = compile(source, "main-thread");
		expect(mainThread.code).toContain("_jsFn: { _jsFn1: { _isFirstScreen: true } }");
		expect(mainThread.registrations).toContain('let { _jsFn1 } = this["_jsFn"];');
		expect(mainThread.registrations).toContain("runOnBackground(_jsFn1)(event.detail.x * scale);");
	});

	it("in a component: a store read as `$name`, and state, which the function then follows", async () => {
		const source = `<script lang="ts">
        import { writable } from "svelte/store";
        const count = writable(0);
        let items = $state([1, 2]);
        let cfg = $state({ a: 1 });
        let { threshold = 100 } = $props();
        function onScroll(event: { detail: { scrollTop: number } }) {
          "main thread";
          return [$count, items, cfg.a, event.detail.scrollTop > threshold];
        }
        function plain() {
          "main thread";
        }
      </script>
      <view main-thread:onscroll={onScroll} main-thread:ontap={plain}></view>`;
		const background = (await component(source, { thread: "background" })).code;
		expect(background).toMatch(
			/_c: \{\s*\$count: \$count\(\),\s*items: \$\.snapshot\(items\),\s*cfg: \{ a: \$\.snapshot\(cfg\.a\) \},\s*threshold: threshold\(\)\s*\}/,
		);
		// The first frame is drawn once: nothing to follow.
		const mainThread = (await component(source, { thread: "main-thread" })).code;
		expect(mainThread).toMatch(
			/let onScroll = \{\s*_c: \{\s*\$count: [\s\S]*?,\s*items,\s*cfg: \{ a: cfg\.a \},\s*threshold\s*\}/,
		);
		expect(registrationsOf(mainThread)).toContain(
			'function (event: { detail: { scrollTop: number } }) {\nlet { $count, items, cfg, threshold } = this["_c"];',
		);
	});
});

describe("what the compile step writes", () => {
	const source = `const scale = 2;

export function double(value: number): number {
  "main thread";
  return value * scale;
}

export const handlers = [
  async (event: { x: number }) => {
    "main-thread";
    await event;
  },
];
export const last = 1;
`;

	it("gives a function the same id on both threads, from the file's name and text", () => {
		const background = compile(source, "background");
		const mainThread = compile(source, "main-thread");
		expect(background.ids).toHaveLength(2);
		expect(mainThread.ids).toEqual(background.ids);
		expect(readOutput(mainThread.code).registrations).toEqual(background.ids);
		expect(background.registrations).toBe("");
		expect(readOutput(background.code).registrations).toEqual([]);
		// Another file, or another text, gives other ids.
		expect(compile(source, "background", "other.ts").ids).not.toEqual(background.ids);
		const edited = compile(source.replace("value * scale", "value + scale"), "background").ids;
		expect(edited).toHaveLength(2);
		for (const id of edited) expect(background.ids).not.toContain(id);
	});

	it("puts an object where each function was", () => {
		const { code } = compile(source, "background");
		expect(code).toMatch(/export let double = \{ _c: \{ scale \}, _wkltId: "[^"]+" \};/);
		expect(code).toMatch(/export const handlers = \[\n {2}\{ _wkltId: "[^"]+" \}/);
		expect(code).toContain("export const last = 1;");
	});

	it("registers each body as it was written, after unpacking what it captured", () => {
		const { code } = compile(source, "main-thread");
		expect(code).toMatch(
			/\nimport \{ loadWorkletRuntime as __svelteLynxLoadWorkletRuntime \} from "@sohedra\/lynx\/internal\/main-thread-functions";\nif \(__svelteLynxLoadWorkletRuntime\(\)\) \{\nregisterWorkletInternal\("main-thread", "[^"]+", function \(value: number\) \{\nlet \{ scale \} = this\["_c"\];\n\n {2}"main thread";\n {2}return value \* scale;\n\}\);\n/,
		);
		expect(code).toMatch(
			/registerWorkletInternal\("main-thread", "[^"]+", async function \(event: \{ x: number \}\) \{\n\n {4}"main-thread";\n {4}await event;\n {2}\}\);\n\}\n$/,
		);
	});

	it("keeps an object from being read as a block", () => {
		const { code } = compile(
			`export const make = () => () => {\n  "main thread";\n};\n`,
			"background",
			"make.js",
		);
		expect(code).toMatch(/export const make = \(\) => \(\{ _wkltId: "[^"]+" \}\)/);
	});

	it("leaves a script without main-thread functions as it is", () => {
		for (const text of [
			`export const a = 1;\n`,
			// The directive's text, but no function that starts with it.
			`// start the body with 'main thread'\nexport const note = "main thread";\nexport function f() { g(); "main thread"; }\n`,
		]) {
			expect(compile(text)).toMatchObject({ code: text, ids: [], registrations: "" });
		}
	});

	it("maps the code after a function to where it was", () => {
		const { code, map } = compileScript(source, { thread: "background", sourceMap: true });
		expect(map?.sources).toEqual(["handlers.ts"]);
		expect(map?.sourcesContent).toEqual([source]);
		expect(code.split("\n")).toHaveLength(map!.mappings.split(";").length);
	});
});

describe("what cannot be a main-thread function", () => {
	const error = (source: string): string => {
		try {
			compile(source, "background", "broken.ts");
		} catch (thrown) {
			return (thrown as Error).message;
		}
		return "";
	};
	const at = (line: number, column: number) => `${inApp("broken.ts")}:${line}:${column}`;

	it("a method of a class or of an object: an error with the file, line and column", () => {
		expect(
			withoutRoot(error(`export class Box {\n  onTap() {\n    "main thread";\n  }\n}\n`)),
		).toMatchSnapshot();
		expect(
			error(`export const box = {\n  get size() {\n    "main thread";\n    return 1;\n  },\n};\n`),
		).toContain(`${at(2, 3)}`);
	});

	it("one that uses `this` or `super`, also from an arrow function inside it", () => {
		expect(
			error(`export function onTap() {\n  "main thread";\n  return () => this.size;\n}\n`),
		).toContain(`${at(3, 16)}`);
		expect(
			error(
				`class Base {}\nexport class Box extends Base {\n  size() {\n    return () => {\n      "main thread";\n      return super.size();\n    };\n  }\n}\n`,
			),
		).toMatch(/^`super` cannot be used in a main-thread function/);
		// A function or a class inside it has its own.
		expect(
			error(
				`export function onTap() {\n  "main thread";\n  class State {\n    value = 1;\n    read() {\n      return this.value;\n    }\n  }\n  return function () {\n    return this;\n  };\n}\n`,
			),
		).toBe("");
	});

	it("a generator", () => {
		expect(error(`export function* steps() {\n  "main thread";\n  yield 1;\n}\n`)).toMatch(
			/^A generator cannot be a main-thread function\./,
		);
	});

	it("a script that does not parse: the parser's error, at its place", () => {
		const message = error(`export function f() {\n  "main thread";\n  return 1 +;\n}\n`);
		expect(message).toMatch(/^A script has a syntax error: Unexpected token/);
		expect(message).toContain(at(3, 13));
	});
});
