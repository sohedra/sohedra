// unorm's normalization, for String.prototype.normalize: its four forms, by name. unorm puts its own
// normalize on strings as it loads, where they have none, so it loads only when the fill first
// normalizes, with the fill's already in place.
export function loadForms() {
	const unorm = require("unorm");
	return { NFC: unorm.nfc, NFD: unorm.nfd, NFKC: unorm.nfkc, NFKD: unorm.nfkd };
}
