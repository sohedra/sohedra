// The only global this package uses besides ES2019 and Svelte's runes: development warnings and
// errors (every platform it runs on has a console).
declare const console: {
	warn(...data: unknown[]): void;
	error(...data: unknown[]): void;
};
