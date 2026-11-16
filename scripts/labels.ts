import { readFileSync } from "node:fs";

import { parse } from "yaml";

export interface Label {
	name: string;
	color: string;
	description: string;
}

/** Reads `.github/labels.yml` and returns its labels, or throws on a malformed entry. */
export function readLabels(file = ".github/labels.yml"): Label[] {
	const data: unknown = parse(readFileSync(file, "utf8"));
	if (!Array.isArray(data)) {
		throw new Error(`${file}: expected a list of labels, but found ${typeof data}.`);
	}
	return data.map((entry: unknown, index) => {
		const { name, color, description } = (entry ?? {}) as Partial<Label>;
		if (typeof name !== "string" || typeof color !== "string" || typeof description !== "string") {
			throw new Error(
				`${file}: entry ${index + 1} needs a name, a color and a description, all strings. Quote a color that is all digits, such as "008672".`,
			);
		}
		return { name, color, description };
	});
}
