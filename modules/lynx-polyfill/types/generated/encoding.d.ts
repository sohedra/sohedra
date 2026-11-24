// Generated from TypeScript 6.0's lib.webworker.d.ts by `pnpm -F @sohedra/lynx-polyfill generate`: do not edit.
// What `import "@sohedra/lynx-polyfill/encoding"` installs on either thread: its globals' types.
// TypeScript's declarations are Copyright Microsoft Corporation, Apache License 2.0.

/// <reference path="./web.d.ts" />

declare global {
	var TextDecoder: {
		prototype: TextDecoder;
		new (label?: string, options?: TextDecoderOptions): TextDecoder;
	};
	var TextEncoder: {
		prototype: TextEncoder;
		new (): TextEncoder;
	};
}

export {};
