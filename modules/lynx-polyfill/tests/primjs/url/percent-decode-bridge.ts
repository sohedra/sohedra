// Decodes each of `PERCENT_DECODE_CASES` with the thread's `URLSearchParams`, after its fills, and
// reports each value's UTF-16 code units: PrimJS's `decodeURIComponent` takes an encoded surrogate
// that the standard refuses.

import { report } from "../realm.ts";

/** Percent-encoded bytes, valid and not, as a query's value. */
export const PERCENT_DECODE_CASES: readonly string[] = [
	"%ED%A0%80",
	"%ED%BF%BF",
	"%ED%A0%80%ED%B0%80",
	"%C0%80",
	"%E2%82",
	"%E2%82%41",
	"%F4%90%80%80",
	"%E2%82%AC",
	"%F0%9F%98%80",
	"%ED%9F%BF",
];

/** The code units of `text`, in hexadecimal. */
export function codeUnits(text: string | null): string {
	if (text === null) return "null";
	const units: string[] = [];
	for (let index = 0; index < text.length; index++) units.push(text.charCodeAt(index).toString(16));
	return units.join(" ");
}

/** Reports each case's decoded value. */
export function connectPercentDecode(): void {
	const decoded: Record<string, string> = {};
	for (const bytes of PERCENT_DECODE_CASES)
		decoded[bytes] = codeUnits(new URLSearchParams(`a=${bytes}`).get("a"));
	report(decoded);
}
