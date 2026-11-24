// The language through ES2025 in an app's code: the binding fills what Lynx's engine lacks, so the
// base tsconfig types it.

export const sorted: number[] = [3, 1, 2].toSorted();
export const last: number | undefined = [1, 2].at(-1);
export const own: boolean = Object.hasOwn({ a: 1 }, "a");
export const grouped = Map.groupBy([1, 2, 3], (value) => value % 2);
export const { promise, resolve } = Promise.withResolvers<number>();
export const tried: Promise<number> = Promise.try(() => 1);
export const escaped: string = RegExp.escape("a.b");
export const union: Set<number> = new Set([1]).union(new Set([2]));
export const doubled: number[] = [1, 2]
	.values()
	.map((value) => value * 2)
	.toArray();
export const half: number = Math.f16round(1.337);
export const normal: string = "é".normalize("NFC");
export const cause: unknown = new Error("outer", { cause: 1 }).cause;
