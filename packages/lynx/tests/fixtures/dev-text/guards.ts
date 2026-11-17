// Source for the development-text scanner's test: which strings are only for development builds.

declare const __DEV__: boolean;
declare function report(message: unknown): void;

/** Only development code calls this one. */
function describeOperation(name: string): string {
	return `update the list ${name}`;
}

/** Production code calls this one too. */
function describeAlways(): string {
	return "this helper also runs in production builds";
}

export function branches(): void {
	if (__DEV__) report("a development message in an if branch");
	report(__DEV__ ? "a development message in a conditional" : "");
	if (__DEV__ && Math.random() > 0.5) report("a development message after an and");
	if (process.env.NODE_ENV !== "production") report("a development message guarded by NODE_ENV");
	if (__DEV__) report(describeOperation("x"));
	report(describeAlways());
}

export function earlyReturn(): void {
	if (!__DEV__) return;
	report("a development message after an early return");
}

export function shipped(): void {
	throw new Error("this message ships in every build");
}

export function both(): void {
	if (__DEV__) report("this text is used in both builds");
	report("this text is used in both builds");
}

export function productionAnd(x: boolean): void {
	if (!__DEV__ && x) return;
	report("this runs in production whenever x is false");
	if (!__DEV__ && x) report("");
	else report("this else runs in production whenever x is false");
	report((!__DEV__ && x) || "this right side runs in production whenever x is false");
}

export function productionOr(x: boolean): void {
	if (!__DEV__ || x) return;
	report("a development message after an or return");
}
