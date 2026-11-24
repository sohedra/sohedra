// `import 'background-only'` on the main thread: the module is replaced by a stub with the same
// exports, so neither its code nor its imports reach the main thread.
//
// A module that imports it must not reach the first frame's markup, but the main thread loads every
// module the page imports, so a build error would forbid importing the module from a component at
// all. The stub keeps the import working: code in onMount, $effect or an event handler never runs
// on the main thread, so it never touches the stub. Using an export while the first frame renders
// (top-level code, markup) throws, and the background thread draws the page instead.
//
// Reads plain JavaScript, whatever compiled it (SWC for TypeScript, Svelte for `.svelte.ts`): it
// runs last on every main-thread script.

import path from "node:path";

import { init, parse } from "es-module-lexer";

import { buildError, describe } from "../diagnostics/messages.ts";
import { stringLiteral } from "../string-literal.ts";

const MARKER = "background-only";
const CJS_MARKER = /\brequire\(\s*(['"])background-only\1\s*\)/;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/** What the stub's message has where the runtime puts what was used. */
const USED = "\u0000used\u0000";

/** What the stub reads. */
interface StubOptions {
	source: string;
	/** The module's file. */
	resourcePath: string;
	/** The app's folder. */
	rootContext: string;
	/** The file `background-only` resolves to. */
	marker: string;
}

/**
 * The main thread's copy of the module: itself, or a stub when it imports `background-only`.
 * Rejects with the build's message for a module the stub cannot stand in for.
 */
export async function backgroundOnlyStub(options: StubOptions): Promise<string> {
	const { source, resourcePath, rootContext, marker } = options;
	// Only a module the stub did not replace still imports the marker on the main thread: a component.
	if (resourcePath === marker) {
		throw buildError({ code: "background_only_in_component", details: {} });
	}
	if (!source.includes(MARKER)) return source;
	await init();
	const [imports, exports, , esm] = parse(source, resourcePath);
	const marked = esm
		? imports.some((entry) => entry.type === "static" && entry.specifier === MARKER)
		: CJS_MARKER.test(source);
	if (!marked) return source;

	const file = path.relative(rootContext, resourcePath).split(path.sep).join("/");
	const prelude = `const file = ${stringLiteral(file)};\n${stubFunction(file)}`;
	if (!esm) return `${prelude}module.exports = stub('module.exports');\n`;

	const names: string[] = [];
	for (const entry of exports) {
		if (entry.typeOnly) continue;
		if (entry.type === "reexport-all") {
			throw buildError({
				code: "background_only_reexport_all",
				details: { file, from: entry.from ?? "" },
			});
		}
		names.push(entry.name);
	}
	const locals = names.map((name, i) => `const _${i} = stub(${stringLiteral(name)});`);
	const specifiers = names.map(
		(name, i) => `_${i} as ${IDENTIFIER.test(name) ? name : stringLiteral(name)}`,
	);
	return `${prelude}${locals.join("\n")}\nexport { ${specifiers.join(", ")} };\n`;
}

/**
 * Calling, constructing or reading a property of a stub throws, with what was used and where to
 * move it. `__esModule` reads as missing, for the bundler's interop with a CommonJS module; `typeof`
 * works ('function').
 */
function stubFunction(file: string): string {
	const message = describe({ code: "background_only_used", details: { used: USED, file } });
	return `function stub(name) {
  const fail = (key) => {
    const used = typeof key === 'string' ? name + '.' + key : name;
    throw new Error(${stringLiteral(message)}.replace(${stringLiteral(USED)}, used));
  };
  return new Proxy(function () {}, {
    get: (target, key) => (key === '__esModule' ? undefined : fail(key)),
    set: (target, key) => fail(key),
    apply: () => fail(),
    construct: () => fail(),
  });
}
`;
}
