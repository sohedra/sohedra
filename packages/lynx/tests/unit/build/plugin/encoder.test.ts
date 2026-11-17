// The template encoder the package carries: handed to the template plugin's encode step, with the
// engine's refusal of Lynx 4.2 turned into the build's message.

import { describe, expect, it } from "@rstest/core";

import { handEncoderOver } from "../../../../src/build/plugin/encoder.ts";

type Run = (task: Record<string, unknown>) => Promise<unknown>;

/** A pool whose `run` records what it was given. */
function pool(run: Run): { encodePool: { run: Run } } {
	return { encodePool: { run } };
}

describe("handEncoderOver", () => {
	it("adds the package's own encoder to every task the pool runs", async () => {
		const tasks: Record<string, unknown>[] = [];
		const owner = pool(async (task) => tasks.push(task));
		handEncoderOver(owner, "file:///package/tasm.js");
		await owner.encodePool.run({ encodeOptions: { a: 1 } });
		expect(tasks).toEqual([{ encodeOptions: { a: 1 }, tasmPkg: "file:///package/tasm.js" }]);
	});

	it("does it once, however often the plugin is set up", async () => {
		const tasks: Record<string, unknown>[] = [];
		const owner = pool(async (task) => tasks.push(task));
		handEncoderOver(owner, "file:///one.js");
		handEncoderOver(owner, "file:///two.js");
		await owner.encodePool.run({});
		expect(tasks).toEqual([{ tasmPkg: "file:///one.js" }]);
	});

	it("fails with the build's message when the plugin has no pool to hand it to", () => {
		expect(() => handEncoderOver({}, "file:///x.js")).toThrow(
			"The Lynx encoder that @sohedra/lynx carries could not be given to the template plugin: its LynxEncodePlugin has no encodePool to run the encode step in.",
		);
	});

	it("turns the engine's refusal of the version into the build's message, with what the engine said", async () => {
		const owner = pool(async () => {
			throw new Error("current compiler only support lynx version 3.9 at most\n");
		});
		handEncoderOver(owner, "file:///x.js");
		await expect(owner.encodePool.run({})).rejects.toMatchObject({
			code: "encoder_not_handed_over",
			message: expect.stringContaining(
				"the engine said: current compiler only support lynx version 3.9 at most.",
			),
		});
	});

	it("leaves any other failure as it is", async () => {
		const failure = new Error("out of memory");
		const owner = pool(async () => {
			throw failure;
		});
		handEncoderOver(owner, "file:///x.js");
		await expect(owner.encodePool.run({})).rejects.toBe(failure);
	});
});
