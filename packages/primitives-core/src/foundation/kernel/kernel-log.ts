import { DEV } from "esm-env";

const PREFIX = "Sohedra";

const logged = new Set<string>();

function createLogOnce(severity: "warn" | "error") {
	return function logOnce(...messages: string[]) {
		if (!DEV) {
			return;
		}
		const output = `${PREFIX}: ${messages.join(" ")}`;
		const key = `${severity}:${output}`;
		if (logged.has(key)) {
			return;
		}
		logged.add(key);
		if (severity === "warn") {
			console.warn(output);
		} else {
			console.error(output);
		}
	};
}

/** Logs a development-only error, prefixed with "Sohedra: ", once per unique message. */
export const error = createLogOnce("error");

/** Logs a development-only warning, prefixed with "Sohedra: ", once per unique message. */
export const warn = createLogOnce("warn");

/** Forgets the logged messages, so each test sees its own. */
export function resetLogs(): void {
	logged.clear();
}
