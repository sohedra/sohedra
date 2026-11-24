// The `decodeURIComponent` whatwg-url-minimum reads by name to percent-decode a run of `%XX`, which
// bundle.ts provides in place of the global: the URL Standard's percent-decode, then UTF-8 decode
// without BOM (Encoding § 4.1), each bad sequence one U+FFFD. The package decodes with the global
// and writes one U+FFFD a byte when it throws: on PrimJS, which takes an encoded surrogate
// (`%ED%A0%80`), it gave a lone surrogate, and a cut sequence (`%E2%82%41`) gave U+FFFD for each
// byte, the `A` too, on every engine. Never throws.

/** `text` with each `%XX` decoded as UTF-8 bytes, a bad sequence as U+FFFD. */
export function decodeURIComponent(text) {
	let decoded = "";
	let codePoint = 0;
	let needed = 0;
	let seen = 0;
	let lower = 0x80;
	let upper = 0xbf;
	let index = 0;
	while (index < text.length) {
		const byte =
			text[index] === "%" && /^[0-9A-Fa-f]{2}$/.test(text.slice(index + 1, index + 3))
				? parseInt(text.slice(index + 1, index + 3), 16)
				: -1;
		if (needed !== 0 && (byte < lower || byte > upper)) {
			// A cut sequence: U+FFFD, and this byte or character starts afresh.
			decoded += "�";
			codePoint = needed = seen = 0;
			lower = 0x80;
			upper = 0xbf;
			continue;
		}
		if (byte === -1) {
			decoded += text[index];
			index += 1;
			continue;
		}
		index += 3;
		if (needed !== 0) {
			lower = 0x80;
			upper = 0xbf;
			codePoint = (codePoint << 6) | (byte & 0x3f);
			if (++seen === needed) {
				decoded += String.fromCodePoint(codePoint);
				codePoint = needed = seen = 0;
			}
		} else if (byte <= 0x7f) decoded += String.fromCharCode(byte);
		else if (byte >= 0xc2 && byte <= 0xdf) {
			needed = 1;
			codePoint = byte & 0x1f;
		} else if (byte >= 0xe0 && byte <= 0xef) {
			if (byte === 0xe0) lower = 0xa0;
			if (byte === 0xed) upper = 0x9f;
			needed = 2;
			codePoint = byte & 0xf;
		} else if (byte >= 0xf0 && byte <= 0xf4) {
			if (byte === 0xf0) lower = 0x90;
			if (byte === 0xf4) upper = 0x8f;
			needed = 3;
			codePoint = byte & 0x7;
		} else decoded += "�";
	}
	return needed === 0 ? decoded : `${decoded}�`;
}
