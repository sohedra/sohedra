// The types of structured-clone.js, which scripts/vendor/bundle.ts writes from
// @ungap/structured-clone.

/** The options of `serialize`. */
export interface SerializeOptions {
	json?: boolean;
	lossy?: boolean;
}

/** Turns a value into a list of records that `deserialize` makes again. */
export function serialize(value: unknown, options?: SerializeOptions): unknown;

/** Makes a value again from what `serialize` made. */
export function deserialize(serialized: unknown): unknown;
