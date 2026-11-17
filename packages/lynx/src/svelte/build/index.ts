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
