// Prints a type of `@lynx-js/types` as text that names nothing of that package: unions, literals
// and objects are written out, and each of Lynx's own interfaces it meets is named once, with a
// `Lynx` prefix, for the writer to declare. No mapped, conditional or generic type reaches the
// text, so the editor never has to evaluate one per element.

import ts from "typescript";

/** What printing reaches: the checker, and the interfaces it has named so far. */
export interface Printer {
	checker: ts.TypeChecker;
	/** Each interface of Lynx's met so far, by the name it is printed with. */
	named: Map<string, ts.Type>;
}

/** How deep an object is written out before the printer gives up on it as `unknown`. */
const MAX_DEPTH = 8;

/** Lynx's type for an element in an event, which the writer replaces with the binding's node. */
const LYNX_TARGETS = new Set(["Target", "Element"]);

/** A property name as a key: bare when it is an identifier, quoted otherwise. */
export function keyOf(name: string): string {
	return /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);
}

/** The fields every event has, which the binding's base event interface declares. */
export const EVENT_BASE: ReadonlySet<string> = new Set([
	"type",
	"timestamp",
	"target",
	"currentTarget",
]);

/** Whether `type` is a function and nothing else. */
export function isFunction(type: ts.Type): boolean {
	return type.getCallSignatures().length > 0 && type.getProperties().length === 0;
}

/** The members of a union, `undefined` left out. */
export function withoutUndefined(type: ts.Type): ts.Type[] {
	const members = type.isUnion() ? type.types : [type];
	return members.filter((member) => (member.flags & ts.TypeFlags.Undefined) === 0);
}

/** The interface of Lynx's that `type` is, if it is a plain one: no type arguments. */
function lynxInterface(type: ts.Type): string | undefined {
	if (type.aliasSymbol) return undefined;
	const symbol = type.getSymbol();
	if (!symbol || (symbol.flags & ts.SymbolFlags.Interface) === 0) return undefined;
	if ((type as ts.TypeReference).typeArguments?.length) return undefined;
	const file = symbol.declarations?.[0]?.getSourceFile().fileName ?? "";
	return file.includes("/@lynx-js/types/") ? symbol.name : undefined;
}

/** The name of a type TypeScript's own library declares (`Map`, `Number`), which prints by name. */
function libraryName(type: ts.Type): string | undefined {
	const symbol = type.getSymbol();
	if (!symbol || (symbol.flags & (ts.SymbolFlags.Interface | ts.SymbolFlags.Class)) === 0)
		return undefined;
	const file = symbol?.declarations?.[0]?.getSourceFile().fileName ?? "";
	return /[\\/]typescript[\\/]lib[\\/]lib\.[\w.]+\.d\.ts$/.test(file) ? symbol.name : undefined;
}

/** The name an interface of Lynx's is printed with. */
export function lynxName(name: string): string {
	return name.startsWith("Lynx") ? name : `Lynx${name.replace(/^Base/, "")}`;
}

/** `text` wrapped in parentheses where an array or a union member needs them. */
function grouped(text: string): string {
	return /^[\w$."'`[\]{}<>]+$/.test(text) || text.startsWith("{") ? text : `(${text})`;
}

/** The text of a type. */
export function printType(printer: Printer, type: ts.Type, depth = 0): string {
	const { checker } = printer;
	const flags = type.flags;
	if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return "unknown";
	if (flags & ts.TypeFlags.String) return "string";
	if (flags & ts.TypeFlags.Number) return "number";
	if (flags & ts.TypeFlags.Boolean) return "boolean";
	if (flags & ts.TypeFlags.Undefined) return "undefined";
	if (flags & ts.TypeFlags.Null) return "null";
	if (flags & ts.TypeFlags.Void) return "void";
	if (flags & ts.TypeFlags.Never) return "never";
	if (flags & ts.TypeFlags.NonPrimitive) return "object";
	// A member of one of Lynx's enums is its value, the enum's name being Lynx's; an ambient enum's
	// members have none written, so they are numbers.
	if (flags & (ts.TypeFlags.EnumLiteral | ts.TypeFlags.Enum) && !type.isUnion()) {
		const { value } = type as ts.LiteralType;
		return typeof value === "string" || typeof value === "number"
			? JSON.stringify(value)
			: "number";
	}
	if (type.isStringLiteral()) return JSON.stringify(type.value);
	if (type.isNumberLiteral()) return String(type.value);
	if (flags & ts.TypeFlags.BooleanLiteral) return checker.typeToString(type);
	if (flags & ts.TypeFlags.TemplateLiteral) return checker.typeToString(type);
	if (type.isUnion()) return printUnion(printer, type.types, depth);
	if (type.isIntersection()) {
		const parts = type.types.map((part) => printType(printer, part, depth));
		return parts.every((part) => part.startsWith("{"))
			? printObject(printer, type, depth)
			: parts.join(" & ");
	}
	if (checker.isArrayType(type) || checker.isTupleType(type)) {
		const args = checker.getTypeArguments(type as ts.TypeReference);
		if (checker.isArrayType(type)) return `${grouped(printType(printer, args[0]!, depth))}[]`;
		return `[${args.map((arg) => printType(printer, arg, depth)).join(", ")}]`;
	}
	const symbol = type.getSymbol();
	if (symbol && LYNX_TARGETS.has(symbol.name) && lynxInterface(type)) return "LynxNode";
	const library = libraryName(type);
	if (library) {
		const args = checker.getTypeArguments(type as ts.TypeReference);
		return args.length > 0
			? `${library}<${args.map((arg) => printType(printer, arg, depth)).join(", ")}>`
			: library;
	}
	if (isFunction(type)) return printFunction(printer, type.getCallSignatures()[0]!, depth);
	// An event's detail (`InputInputEvent`) is written out where it is: a name of its own would read
	// as an event.
	const named = lynxInterface(type);
	if (named && !/Event(?:Detail)?$/.test(named)) {
		const name = lynxName(named);
		const known = printer.named.get(name);
		if (known && known !== type) throw new Error(`Two of Lynx's interfaces print as ${name}.`);
		printer.named.set(name, type);
		return name;
	}
	if (depth >= MAX_DEPTH) return "unknown";
	// Lynx's types give some events another event as their detail (`<image>`'s `load` and `error`):
	// what reaches the detail is that event's fields, never its targets or functions.
	if (named && type.getProperty("target") && type.getProperty("currentTarget"))
		return printObject(printer, type, depth, (property) => {
			const propertyType = checker.getNonNullableType(checker.getTypeOfSymbol(property));
			return !EVENT_BASE.has(property.name) && !isFunction(propertyType);
		});
	return printObject(printer, type, depth);
}

/** A union, with `true | false` as `boolean` and each member once. */
export function printUnion(printer: Printer, members: readonly ts.Type[], depth = 0): string {
	const texts: string[] = [];
	const booleans = members.filter((member) => member.flags & ts.TypeFlags.BooleanLiteral);
	for (const member of members) {
		if (booleans.length === 2 && member.flags & ts.TypeFlags.BooleanLiteral) {
			if (member === booleans[0]) texts.push("boolean");
			continue;
		}
		const text = printType(printer, member, depth);
		if (!texts.includes(text)) texts.push(text);
	}
	return texts.includes("unknown") ? "unknown" : texts.map(grouped).join(" | ");
}

/** A function type, as an arrow. */
function printFunction(printer: Printer, signature: ts.Signature, depth: number): string {
	const parameters = signature.getParameters().map((parameter) => {
		const declaration = parameter.valueDeclaration as ts.ParameterDeclaration | undefined;
		const rest = declaration?.dotDotDotToken ? "..." : "";
		const optional = declaration?.questionToken ? "?" : "";
		const type = printer.checker.getTypeOfSymbol(parameter);
		const text = optional
			? printUnion(printer, withoutUndefined(type), depth + 1)
			: printType(printer, type, depth + 1);
		return `${rest}${parameter.name}${optional}: ${text}`;
	});
	const result = printType(printer, signature.getReturnType(), depth + 1);
	return `(${parameters.join(", ")}) => ${result}`;
}

/** An object type written out: its index signatures, then its properties. */
export function printObject(
	printer: Printer,
	type: ts.Type,
	depth: number,
	keep: (property: ts.Symbol) => boolean = () => true,
): string {
	const { checker } = printer;
	const lines: string[] = [];
	for (const info of checker.getIndexInfosOfType(type)) {
		const key = printType(printer, info.keyType, depth + 1);
		lines.push(`[key: ${key}]: ${printType(printer, info.type, depth + 1)};`);
	}
	for (const property of checker.getPropertiesOfType(type).filter(keep)) {
		const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
		const propertyType = checker.getTypeOfSymbol(property);
		const text = optional
			? printUnion(printer, withoutUndefined(propertyType), depth + 1)
			: printType(printer, propertyType, depth + 1);
		lines.push(
			`${docComment(docOf(checker, property))}${keyOf(property.name)}${optional ? "?" : ""}: ${text};`,
		);
	}
	return lines.length === 0 ? "{}" : `{\n${lines.join("\n")}\n}`;
}

/** The tags of Lynx's doc comments the output keeps; the platform versions are left out. */
const KEPT_TAGS = new Set(["defaultValue", "deprecated", "example"]);

/** The doc comment of a symbol, as the lines of its text: the description, then the kept tags. */
export function docOf(checker: ts.TypeChecker, symbol: ts.Symbol): string[] {
	const description = ts.displayPartsToString(symbol.getDocumentationComment(checker));
	const lines = cleanLines(description);
	for (const tag of symbol.getJsDocTags(checker)) {
		if (!KEPT_TAGS.has(tag.name)) continue;
		const text = cleanLines(ts.displayPartsToString(tag.text)).join(" ");
		lines.push(text ? `@${tag.name} ${text}` : `@${tag.name}`);
	}
	return lines;
}

/** An event attribute in Lynx's spelling, as Lynx's doc text names one (`bindscrolltoupper`). */
const LYNX_EVENT_SPELLING =
	/\b(capture-bind|capture-catch|global-bind|bind|catch)(?!(?:ing|ings|s|es|er)\b)([a-z]+)/g;

/** An event attribute in the binding's spelling: `bindtap` is `ontap`, `catchtap` `oncatchtap`. */
function bindingSpelling(prefix: string, event: string): string {
	if (prefix === "catch") return `oncatch${event}`;
	if (prefix === "capture-bind") return `on${event}capture`;
	if (prefix === "capture-catch") return `oncatch${event}capture`;
	return `on${event}`;
}

/** The lines of a doc text, each trimmed, with what an unclosed tag left inside it taken out. */
function cleanLines(text: string): string[] {
	return text
		.split("\n")
		.map((line) =>
			line
				.replace(/\s+\*\s+@\w+\s*$/, "")
				.replace(/\s+/g, " ")
				.replaceAll("*/", "*\\/")
				.replace(LYNX_EVENT_SPELLING, (_, prefix: string, event: string) =>
					bindingSpelling(prefix, event),
				)
				.replace(/\b([Cc])ancell(ed|ing)\b/g, "$1ancel$2")
				.trim(),
		)
		.filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""))
		.filter((line, index, all) => line !== "" || index < all.length - 1);
}

/** A doc comment of these lines, on one line when there is one: empty when there are none. */
export function docComment(lines: readonly string[]): string {
	if (lines.length === 0) return "";
	if (lines.length === 1) return `/** ${lines[0]} */\n`;
	return `/**\n${lines.map((line) => (line ? ` * ${line}` : " *")).join("\n")}\n */\n`;
}
