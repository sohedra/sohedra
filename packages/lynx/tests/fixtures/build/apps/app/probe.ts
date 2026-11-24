// What a package written for Lynx reads. Each constant is replaced by the thread's value.
declare const __LEPUS__: boolean;
declare const __JS__: boolean;
declare const __API__: string;
declare const process: { env: { DEBUG?: string | null } };

export const probe =
	"lepus=" +
	__LEPUS__ +
	" js=" +
	__JS__ +
	" side=" +
	__API__ +
	" debug=" +
	process.env.DEBUG +
	";" +
	// The web's `fetch`, which the background's wrapper would otherwise give as lynx-core's.
	typeof fetch;
