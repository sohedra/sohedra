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
export type { AnyNode, ScriptProgram } from "./ast.ts";
export { svelteCompiler } from "./compiler.ts";
export type {
	AST,
	CompileOptions,
	ComponentAst,
	ModuleCompileOptions,
	PreprocessorGroup,
	SvelteCompiler,
	Warning,
} from "./compiler.ts";
export { bannedFeature, isBoundaryCrash, isDiagnostic, splitLink } from "./errors.ts";
export type { Diagnostic } from "./errors.ts";
export { scriptParser } from "./script-parser.ts";
export type { ScriptParser } from "./script-parser.ts";
export { hotFooter } from "./hot-footer.ts";
export type { HotFooter } from "./hot-footer.ts";
export { PRIMJS_REGEX_REWRITES, rewritePrimjsRegex } from "./primjs-regex.ts";
export type { PrimjsRegexRewrite } from "./primjs-regex.ts";
export { SPREAD_SETTER_ANCHORS, SPREAD_SETTER_FILE, patchSpreadSetter } from "./spread-setter.ts";
export type { SpreadSetterAnchor } from "./spread-setter.ts";
