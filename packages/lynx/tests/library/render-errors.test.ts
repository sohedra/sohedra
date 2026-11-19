// What `render` says when it cannot draw the page: each names the preset the test runs under.

import { expect, it } from "@rstest/core";
import { render } from "@sohedra/lynx/testing";
import type { Component } from "svelte";

// A component the test preset did not compile: it has no first-frame copy.
const Plain = (() => {}) as unknown as Component;

// The runner this file runs under (it is the same file under both).
const runner = process.env["VITEST"] ? "vitest" : "rstest";
const other = runner === "vitest" ? "rstest" : "vitest";

it("names the preset the test runs under when a component has no first-frame copy", async () => {
	const error = await render(Plain, { lynx: { firstFrame: true } }).catch(
		(thrown: Error) => thrown,
	);
	expect(error).toBeInstanceOf(Error);
	const message = (error as Error).message;
	expect(message).toContain(`@sohedra/lynx/config/${runner}`);
	expect(message).not.toContain(`@sohedra/lynx/config/${other}`);
	expect(message).toContain("without `firstFrame: false`");
});

it("names the preset the test runs under when a first frame alone has no copy", async () => {
	const error = await render(Plain, { lynx: { background: false } }).catch(
		(thrown: Error) => thrown,
	);
	expect((error as Error).message).toContain(`@sohedra/lynx/config/${runner}`);
	expect((error as Error).message).not.toContain(`@sohedra/lynx/config/${other}`);
});

it("names the preset the test runs under when there is no DOM", async () => {
	const g = globalThis as Record<string, unknown>;
	const document = Object.getOwnPropertyDescriptor(g, "document");
	delete g["document"];
	try {
		const error = await render(Plain, { lynx: { firstFrame: false } }).catch(
			(thrown: Error) => thrown,
		);
		const message = (error as Error).message;
		expect(message).toContain("There is no DOM");
		expect(message).toContain(`@sohedra/lynx/config/${runner}`);
		expect(message).not.toContain(`@sohedra/lynx/config/${other}`);
	} finally {
		if (document) Object.defineProperty(g, "document", document);
	}
});

it("refuses a second page while one is rendered", async () => {
	const { default: Counter } = await import("../fixtures/library/Counter.svelte");
	await render(Counter);
	await expect(render(Counter)).rejects.toThrow("a Lynx view shows one page at a time");
});
