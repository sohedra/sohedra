// The types of normalize.js, which scripts/polyfill/bundle.ts writes from unorm.

/** One of Unicode's normalization forms: it gives a string in that form. */
export type NormalizationForm = (text: string) => string;

/** Loads unorm, once, and gives its four forms by name. */
export function loadForms(): Record<"NFC" | "NFD" | "NFKC" | "NFKD", NormalizationForm>;
