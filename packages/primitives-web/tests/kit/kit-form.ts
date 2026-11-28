// A control's form side: the visually hidden input a checked control keeps its value in.

/** The hidden `<input>` of `type` that a checked control renders inside `container`. */
export function hiddenInput(
	container: ParentNode,
	type: "checkbox" | "radio" = "checkbox",
): HTMLInputElement {
	const input = container.querySelector<HTMLInputElement>(
		`input[type="${type}"][aria-hidden="true"]`,
	);
	if (input === null) {
		throw new Error(`No hidden ${type} input is rendered inside the container.`);
	}
	return input;
}
