// Generated from TypeScript 6.0's lib.webworker.d.ts by `pnpm -F @sohedra/lynx-polyfill generate`: do not edit.
// What `import "@sohedra/lynx-polyfill/url-pattern"` installs on either thread: its globals' types.
// TypeScript's declarations are Copyright Microsoft Corporation, Apache License 2.0.

/// <reference path="./web.d.ts" />

declare global {
	var URL: {
		prototype: URL;
		new (url: string | URL, base?: string | URL): URL;
		canParse(url: string | URL, base?: string | URL): boolean;
		createObjectURL(obj: Blob): string;
		parse(url: string | URL, base?: string | URL): URL | null;
		revokeObjectURL(url: string): void;
	};
	var URLPattern: {
		prototype: URLPattern;
		new (input: URLPatternInput, baseURL: string | URL, options?: URLPatternOptions): URLPattern;
		new (input?: URLPatternInput, options?: URLPatternOptions): URLPattern;
	};
	var URLSearchParams: {
		prototype: URLSearchParams;
		new (init?: string[][] | Record<string, string> | string | URLSearchParams): URLSearchParams;
	};
}

export {};
