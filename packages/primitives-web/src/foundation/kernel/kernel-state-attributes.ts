export type StateAttributesMapping<State> = {
	[Property in keyof State]?: (value: State[Property]) => Record<string, string> | null;
};

/**
 * Turns state into `data-*` attributes: `true` → `data-key=""`, other truthy values →
 * `data-key="value"`, falsy → absent. A mapping entry replaces the default for its key.
 */
export function getStateAttributesProps<State extends object>(
	state: State,
	mapping?: StateAttributesMapping<State>,
): Record<string, string> {
	const props: Record<string, string> = {};
	for (const key in state) {
		const value = state[key];
		const mapped = mapping?.[key];
		if (mapped) {
			const custom = mapped(value);
			if (custom != null) {
				Object.assign(props, custom);
			}
			continue;
		}
		if (value === true) {
			props[`data-${key.toLowerCase()}`] = "";
		} else if (value) {
			props[`data-${key.toLowerCase()}`] = String(value);
		}
	}
	return props;
}
