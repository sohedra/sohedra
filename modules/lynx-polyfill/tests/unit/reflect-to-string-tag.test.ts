// ES2020's `Reflect[Symbol.toStringTag]`, by core-js's module: on a `Reflect` without it, as
// PrimJS's, against this process's own.

import { describe, expect, it } from "@rstest/core";

import { fillReflectToStringTag } from "../../src/fills/language/reflect-to-string-tag.ts";
import { fillOnDevice } from "./device-built-ins.ts";

const own = Object.getOwnPropertyDescriptor(Reflect, Symbol.toStringTag);

describe("on a Reflect without it", () => {
	it("puts it in place as V8 has it: not writable, not enumerable, configurable", () => {
		let descriptor: PropertyDescriptor | undefined;
		fillOnDevice({
			gaps: [[Reflect, Symbol.toStringTag]],
			fill: () => {
				fillReflectToStringTag();
				descriptor = Object.getOwnPropertyDescriptor(Reflect, Symbol.toStringTag);
				expect(Object.prototype.toString.call(Reflect)).toBe("[object Reflect]");
			},
		});
		expect(descriptor).toEqual(own);
	});

	it("leaves V8's own", () => {
		fillOnDevice({ gaps: [], fill: fillReflectToStringTag });
		expect(Object.getOwnPropertyDescriptor(Reflect, Symbol.toStringTag)).toEqual(own);
	});
});
