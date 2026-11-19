// What the build tests use of jsdom, which publishes no types: a document to run a built page on.

declare module "jsdom" {
	export class JSDOM {
		constructor(html?: string);
		readonly window: { readonly document: Document };
	}
}
