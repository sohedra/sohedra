const BASE =
	"clip-path: inset(50%); overflow: hidden; white-space: nowrap; border: 0; padding: 0; width: 1px; height: 1px";

/** Hides an element visually, out of the layout flow. */
export const visuallyHidden = `${BASE}; position: fixed; margin: 0; top: 0; left: 0`;

/** Hides a form input visually, positioned so native validation bubbles point near it. */
export const visuallyHiddenInput = `${BASE}; margin: -1px; position: absolute`;
