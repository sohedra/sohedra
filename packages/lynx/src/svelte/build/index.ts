// Every touch of Svelte's compiler and source files, in Node.

export {
	attributeName,
	attributesOf,
	attributeValue,
	bodyNodes,
	field,
	identifierName,
	nodes,
	optionAttributes,
	scriptProgram,
} from "./ast.ts";
export type {
	AnyNode,
	ImportKinds,
	ScriptExpression,
	ScriptProgram,
	ScriptStatement,
} from "./ast.ts";
export { svelteCompiler } from "./compiler.ts";
export type {
	CompileOptions,
	ComponentAst,
	ModuleCompileOptions,
	PreprocessorGroup,
	SvelteCompiler,
	Warning,
} from "./compiler.ts";
export { bannedFeature, isDiagnostic, splitLink } from "./errors.ts";
export type { Diagnostic } from "./errors.ts";
export { scriptParser } from "./script-parser.ts";
export type { ScriptParser } from "./script-parser.ts";
export { hotFooter } from "./hot-footer.ts";
export { isPrimjsRegexFile, PRIMJS_REGEX_REWRITES, rewritePrimjsRegex } from "./primjs-regex.ts";
export { SPREAD_SETTER_ANCHORS, SPREAD_SETTER_FILE, patchSpreadSetter } from "./spread-setter.ts";
export {
	SERVER_ASYNC_HOOKS_IMPORT,
	SERVER_CRYPTO_FILE,
	SERVER_RUNTIME_MODULE,
} from "./server-imports.ts";
