// Reads what the element types are made of from `@lynx-js/types`: every element and its
// attributes, the events each element sends and their types, each element's UI methods, and
// `SystemInfo`. The model holds text already printed, so writing it needs no checker.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import {
	docOf,
	isFunction,
	keyOf,
	lynxName,
	printObject,
	printType,
	printUnion,
	withoutUndefined,
} from "./print.ts";
import type { Printer } from "./print.ts";

/** An attribute, a method's field or a property, as text. */
export interface Field {
	name: string;
	optional: boolean;
	type: string;
	doc: string[];
}

/** An event an element sends: its name (`tap`), the interface of its event, and Lynx's doc. */
export interface EventField {
	name: string;
	event: string;
	doc: string[];
}

/** One element: its tag, what it adds to every element's attributes, and its own events. */
export interface ElementModel {
	tag: string;
	doc: string[];
	/** Whether it has every element's attributes and events; `<inline-truncation>` has none. */
	common: boolean;
	/** Whether it has the defaults: the ones of every element's that a few elements have their own of. */
	defaults: boolean;
	attributes: Field[];
	events: EventField[];
}

/** An event interface: its name, Lynx's doc, and its fields past those every event has. */
export interface EventModel {
	name: string;
	doc: string[];
	fields: Field[];
}

/** A UI method: its parameters (`undefined` when it takes none) and what it resolves with. */
export interface MethodModel {
	name: string;
	doc: string[];
	params: string | undefined;
	/** Whether a call must give `params`: one of its fields is required. */
	required: boolean;
	result: string;
}

/** What the generated types are made of. */
export interface Model {
	/** The version of `@lynx-js/types` read. */
	version: string;
	common: { attributes: Field[]; events: EventField[] };
	/** What most elements have as every element has, and a few have their own versions of. */
	defaults: { attributes: Field[]; events: EventField[] };
	elements: ElementModel[];
	events: EventModel[];
	/** The interfaces of Lynx's the attributes and events name, written out. */
	interfaces: { name: string; doc: string[]; body: string }[];
	methods: { common: MethodModel[]; byTag: { tag: string; methods: MethodModel[] }[] };
	systemInfo: { platforms: string; fields: Field[]; doc: string[] };
}

/** Lynx's event attribute spellings: `bindtap` names the event; the others are the same event. */
const BIND = /^bind(.+)$/;
const OTHER_EVENT_SPELLING = /^(?:catch|capture-bind|capture-catch|global-bind|main-thread:)/;

/** The fields every event has, which the base interface declares. */
const EVENT_BASE = new Set(["type", "timestamp", "target", "currentTarget"]);

/** Where `@lynx-js/types` is, and its version. */
function lynxTypes(): { root: string; version: string } {
	// Its manifest is not one of its exports, so it is read from the package's folder.
	const folder = fileURLToPath(new URL("../../node_modules/@lynx-js/types/", import.meta.url));
	const manifest = JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8")) as {
		version: string;
	};
	return { root: path.join(folder, "types"), version: manifest.version };
}

/** The type a top-level interface or type alias of `file` declares. */
function declared(program: ts.Program, file: string, name: string): ts.Type {
	const source = program.getSourceFile(file);
	const checker = program.getTypeChecker();
	let found: ts.Type | undefined;
	source?.forEachChild((node) => {
		if (
			(ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
			node.name.text === name
		) {
			const symbol = checker.getSymbolAtLocation(node.name);
			if (symbol) found = checker.getDeclaredTypeOfSymbol(symbol);
		}
	});
	if (!found) throw new Error(`@lynx-js/types no longer declares ${name} in ${file}.`);
	return found;
}

/** The doc of a property: its own, or else that of the `LynxEvent<T>['TouchStart']` it is typed as. */
function propertyDoc(checker: ts.TypeChecker, property: ts.Symbol): string[] {
	const own = docOf(checker, property);
	if (own.length > 0) return own;
	const declaration = property.valueDeclaration;
	const node = declaration && ts.isPropertySignature(declaration) ? declaration.type : undefined;
	if (node && ts.isIndexedAccessTypeNode(node) && ts.isLiteralTypeNode(node.indexType)) {
		const owner = checker.getTypeFromTypeNode(node.objectType);
		const key = node.indexType.literal;
		const indexed = ts.isStringLiteral(key) ? owner.getProperty(key.text) : undefined;
		if (indexed) return docOf(checker, indexed);
	}
	return [];
}

/** A property as a field: its name, whether it may be left out, its type and its doc. */
function fieldOf(printer: Printer, property: ts.Symbol): Field {
	const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
	const type = printer.checker.getTypeOfSymbol(property);
	return {
		name: property.name,
		optional,
		type: optional ? printUnion(printer, withoutUndefined(type)) : printType(printer, type),
		doc: propertyDoc(printer.checker, property),
	};
}

/** The first parameter of an event attribute's handler: the event. */
function eventParameter(checker: ts.TypeChecker, property: ts.Symbol): ts.Type {
	const handler = checker.getNonNullableType(checker.getTypeOfSymbol(property));
	const parameter = handler.getCallSignatures()[0]?.getParameters()[0];
	if (!parameter) throw new Error(`Lynx's ${property.name} takes no event.`);
	return checker.getTypeOfSymbol(parameter);
}

/**
 * The name of an event's interface, from Lynx's: `BaseTouchEvent<Target>` is `LynxTouchEvent`, and
 * `BaseEvent<"bindinput", InputInputEvent>` is named for its detail, `LynxInputInputEvent`. An event
 * that adds nothing to every event's fields is `LynxEvent`.
 */
function eventName(checker: ts.TypeChecker, type: ts.Type): string {
	const symbol = type.aliasSymbol ?? type.getSymbol();
	const name = symbol?.name ?? "";
	if (name === "BaseEvent" || name === "BaseEventOrig") {
		const args = type.aliasTypeArguments ?? checker.getTypeArguments(type as ts.TypeReference);
		const detail = args[1] ?? args[0];
		const detailName = detail?.aliasSymbol?.name ?? detail?.getSymbol()?.name;
		return detailName && detailName !== "__type" ? lynxName(detailName) : "LynxEvent";
	}
	return lynxName(name.replace(/DetailEvent$/, "Event"));
}

/** The fields of an event past those every event has; functions are left out, as a copy has none. */
function eventFields(printer: Printer, type: ts.Type): Field[] {
	const { checker } = printer;
	return checker
		.getPropertiesOfType(type)
		.filter((property) => !EVENT_BASE.has(property.name))
		.filter(
			(property) => !isFunction(checker.getNonNullableType(checker.getTypeOfSymbol(property))),
		)
		.map((property) => fieldOf(printer, property));
}

/** A UI method's interface (`{ method: "scrollTo"; params: …; success?: Callback<…> }`) as a model. */
function methodOf(printer: Printer, type: ts.Type): MethodModel {
	const { checker } = printer;
	const methodType = checker.getTypeOfSymbol(type.getProperty("method")!);
	if (!methodType.isStringLiteral()) throw new Error("A UI method of Lynx's names no method.");
	const paramsSymbol = type.getProperty("params");
	let params: string | undefined;
	let required = false;
	if (paramsSymbol) {
		const paramsType = checker.getNonNullableType(checker.getTypeOfSymbol(paramsSymbol));
		params = printObject(printer, paramsType, 0);
		required =
			(paramsSymbol.flags & ts.SymbolFlags.Optional) === 0 &&
			checker
				.getPropertiesOfType(paramsType)
				.some((field) => (field.flags & ts.SymbolFlags.Optional) === 0);
	}
	const success = type.getProperty("success");
	const callback = success && checker.getNonNullableType(checker.getTypeOfSymbol(success));
	const answer = callback?.getCallSignatures()[0]?.getParameters()[0];
	const result = answer ? printType(printer, checker.getTypeOfSymbol(answer)) : "unknown";
	return {
		name: methodType.value,
		doc: docOf(checker, type.getSymbol()!),
		params,
		required,
		result,
	};
}

/** The members of a union of method interfaces, as models, sorted by name. */
function methodsOf(printer: Printer, union: ts.Type): MethodModel[] {
	const members = union.isUnion() ? union.types : [union];
	return members
		.map((member) => methodOf(printer, member))
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** Reads `@lynx-js/types`, leaving out the tags in `omit`. */
export function readLynxTypes(omit: ReadonlySet<string>): Model {
	const { root, version } = lynxTypes();
	const file = (name: string) => path.join(root, name);
	const program = ts.createProgram([file("index.d.ts")], {
		strict: true,
		skipLibCheck: true,
		noEmit: true,
		types: [],
		lib: ["lib.es2021.d.ts"],
	});
	const checker = program.getTypeChecker();
	const printer: Printer = { checker, named: new Map() };

	const intrinsic = declared(program, file("common/element/element.d.ts"), "IntrinsicElements");
	const standard = declared(program, file("common/props.d.ts"), "StandardProps");
	const standardProps = new Map(checker.getPropertiesOfType(standard).map((p) => [p.name, p]));
	const sameAs = (property: ts.Symbol) =>
		standardProps.get(property.name)?.declarations?.[0] === property.declarations?.[0];

	const tags = checker
		.getPropertiesOfType(intrinsic)
		.filter((tag) => !omit.has(tag.name))
		.map((tag) => ({
			symbol: tag,
			props: checker.getPropertiesOfType(checker.getTypeOfSymbol(tag)),
		}));

	// Every element's attributes are the standard ones that each element with any has as they are.
	const withCommon = tags.filter(({ props }) =>
		[...standardProps.keys()].every((name) => props.some((p) => p.name === name)),
	);
	const commonNames = new Set(
		[...standardProps.keys()].filter((name) =>
			withCommon.every(({ props }) => sameAs(props.find((p) => p.name === name)!)),
		),
	);

	const eventsByType = new Map<ts.Type, EventModel>();
	const eventOf = (property: ts.Symbol, name: string): EventField => {
		const type = eventParameter(checker, property);
		let model = eventsByType.get(type);
		if (!model) {
			const named = eventName(checker, type);
			const fields = named === "LynxEvent" ? [] : eventFields(printer, type);
			const symbol = type.aliasSymbol ?? type.getSymbol();
			model = { name: named, doc: symbol ? docOf(checker, symbol) : [], fields };
			eventsByType.set(type, model);
		}
		return { name, event: model.name, doc: propertyDoc(checker, property) };
	};

	/** An element's attributes and events, as Lynx spells them, in the binding's model. */
	const split = (props: readonly ts.Symbol[]) => {
		const attributes: Field[] = [];
		const events: EventField[] = [];
		for (const property of props) {
			const bind = BIND.exec(property.name);
			if (bind) events.push(eventOf(property, bind[1]!));
			else if (!OTHER_EVENT_SPELLING.test(property.name))
				attributes.push(fieldOf(printer, property));
		}
		return { attributes, events };
	};

	// The rest of the standard ones, which some elements have their own of (`<input>`'s `focus`).
	const defaultNames = new Set([...standardProps.keys()].filter((name) => !commonNames.has(name)));
	const common = split([...standardProps.values()].filter((p) => commonNames.has(p.name)));
	const defaults = split([...standardProps.values()].filter((p) => defaultNames.has(p.name)));
	const elements = tags.map(({ symbol, props }): ElementModel => {
		const extendsCommon = withCommon.some((tag) => tag.symbol === symbol);
		const keepsDefaults =
			extendsCommon &&
			[...defaultNames].every((name) => sameAs(props.find((p) => p.name === name)!));
		const own = props.filter(
			(p) =>
				!extendsCommon ||
				(!commonNames.has(p.name) && !(keepsDefaults && defaultNames.has(p.name))),
		);
		return {
			tag: symbol.name,
			doc: docOf(checker, symbol),
			common: extendsCommon,
			defaults: keepsDefaults,
			...split(own),
		};
	});

	// Two event types under one name would be one interface with the fields of only one of them.
	const events = new Map<string, EventModel>();
	for (const model of eventsByType.values()) {
		const known = events.get(model.name);
		if (known && JSON.stringify(known.fields) !== JSON.stringify(model.fields))
			throw new Error(`Two of Lynx's event types are both named ${model.name}.`);
		events.set(model.name, model);
	}
	events.delete("LynxEvent");

	const uiMethods = declared(program, file("common/element/element.d.ts"), "UIMethods");
	const invokeParams = declared(program, file("common/element/methods.d.ts"), "InvokeParams");
	const byTag = checker
		.getPropertiesOfType(uiMethods)
		.filter((tag) => !omit.has(tag.name))
		.map((tag) => ({ tag: tag.name, methods: methodsOf(printer, checker.getTypeOfSymbol(tag)) }));
	// Every element's methods: the ones `invoke` takes that no element has as its own.
	const own = new Set(byTag.flatMap(({ methods }) => methods.map((method) => method.name)));
	const commonMethods = (invokeParams as ts.UnionType).types
		.map((type) => methodOf(printer, type))
		.filter((method) => !own.has(method.name));
	const commonMethodModels = commonMethods.sort((a, b) => a.name.localeCompare(b.name));

	const systemInfoType = declared(program, file("common/system-info.d.ts"), "SystemInfo");
	const platformType = declared(program, file("common/system-info.d.ts"), "PlatformType");
	const systemInfo = {
		platforms: printUnion(printer, (platformType as ts.UnionType).types),
		doc: docOf(checker, systemInfoType.getSymbol()!),
		fields: checker.getPropertiesOfType(systemInfoType).map((property) => {
			const field = fieldOf(printer, property);
			return field.type.includes('"Android"') ? { ...field, type: "PlatformType" } : field;
		}),
	};

	// The interfaces met while printing, written out; each may meet more.
	const interfaces: Model["interfaces"] = [];
	const written = new Set<string>();
	for (
		let pending = [...printer.named];
		pending.length > 0;
		pending = [...printer.named].filter(([name]) => !written.has(name))
	) {
		for (const [name, type] of pending) {
			written.add(name);
			interfaces.push({
				name,
				doc: docOf(checker, type.getSymbol()!),
				body: printObject(printer, type, 0),
			});
		}
	}
	interfaces.sort((a, b) => a.name.localeCompare(b.name));

	return {
		version,
		common,
		defaults,
		elements,
		events: [...events.values()].sort((a, b) => a.name.localeCompare(b.name)),
		interfaces,
		methods: { common: commonMethodModels, byTag },
		systemInfo,
	};
}

export { keyOf };
