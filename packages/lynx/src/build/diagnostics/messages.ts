// The build's messages as errors and warnings that name their place: `file:line:col` and a few
// lines of the source around it.

import { docsLink, formatMessage } from "../../wire/index.ts";
import { position } from "../source-map/maps.ts";
import { BUILD_CATALOGUE } from "./catalogue.ts";
import type { BuildCode, BuildDetails } from "./catalogue.ts";

/** A file's text. */
export interface SourceText {
	file: string;
	text: string;
}

/** A place in a file's text. */
export interface Place {
	file: string;
	/** `file:line:column`, 1-based, as editors open them. */
	where: string;
	/** The line before, the line, and a caret under the place. */
	frame: string;
}

/** The place at `offset` of `source`. */
export function placeAt(source: SourceText, offset: number): Place {
	const [index, column] = position(source.text, offset);
	const line = index + 1;
	const lines = source.text.split("\n");
	const frame = [line - 1, line]
		.filter((number) => number >= 1)
		.map((number) => `${number}: ${lines[number - 1]}`)
		.concat(`${" ".repeat(String(line).length + 2 + column)}^`)
		.join("\n");
	return { file: source.file, where: `${source.file}:${line}:${column + 1}`, frame };
}

/** A build error: its text has the message's parts, and `code` is the message's stable code. */
export type BuildError = Error & { code: string; hideStack: true };

/** One message to write: its code, the details it is written from, and where it happened. */
export interface Report<Code extends BuildCode> {
	code: Code;
	details: BuildDetails[Code];
	place?: Place;
}

/** The text of a message. */
export function describe<Code extends BuildCode>({ code, details, place }: Report<Code>): string {
	const entry = BUILD_CATALOGUE[code];
	return formatMessage({
		sentence: entry.message(details),
		where: place?.where,
		frame: place?.frame,
		fix: entry.fix(details),
		link: docsLink(entry.docs),
	});
}

/** The error for a message. The loader's stack says nothing about the file, so it hides it. */
export function buildError<Code extends BuildCode>(report: Report<Code>): BuildError {
	return Object.assign(new Error(describe(report)), {
		code: report.code,
		hideStack: true as const,
	});
}

/** A warning of the build or of Svelte's compiler, ready to report. */
export interface BuildWarning {
	code: string;
	message: string;
}

/** The warning for a message. */
export function buildWarning<Code extends BuildCode>(report: Report<Code>): BuildWarning {
	return { code: report.code, message: describe(report) };
}

/** A message to write, of any code. */
export type AnyReport = { [Code in BuildCode]: Report<Code> }[BuildCode];

/**
 * One error for every message in `reports`, the first message's text first, so a collapsed
 * console shows its sentence. It carries the first message's code.
 */
export function buildErrors(reports: [AnyReport, ...AnyReport[]]): BuildError {
	const [first] = reports;
	const text = reports.map((report) => describe(report as Report<BuildCode>)).join("\n\n\n");
	return Object.assign(new Error(text), { code: first.code as string, hideStack: true as const });
}
