// The `atob` a vendored module reads by name as it loads (whatwg-url-minimum decodes its IDNA tables
// with it): a module's own, which bundle.ts provides in place of the global, since a thread has no
// `atob` until the package's fills run, after every module has loaded. It decodes the
// package's own tables, which are well-formed base64: no checks.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** The bytes `encoded` stands for, as a string of Latin-1 characters. */
export function atob(encoded) {
	let bytes = "";
	let buffer = 0;
	let bits = 0;
	for (let index = 0; index < encoded.length; index++) {
		const value = ALPHABET.indexOf(encoded[index]);
		if (value === -1) continue;
		buffer = (buffer << 6) | value;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes += String.fromCharCode((buffer >> bits) & 0xff);
		}
	}
	return bytes;
}
