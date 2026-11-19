// One build with Rsdoctor, the build analyzer, which wraps each loader of the bundler's rules to
// time it: the binding's loaders work under its wrapper, and the component's CSS still reaches the
// template through the loader its import names (which Rsdoctor does not wrap).

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { afterAll, beforeAll, describe, expect, it, rs } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;

beforeAll(async () => {
	// Rsdoctor logs its every step while `DEBUG` is set, as the build tests set it.
	const log = console.log;
	const quiet = rs
		.spyOn(console, "log")
		.mockImplementation((...args: unknown[]) =>
			String(args[0]).includes("RSDOCTOR") ? undefined : log(...args),
		);
	build = await buildApp("app", {
		rsbuild: {
			tools: {
				rspack: {
					plugins: [
						// No browser and no server; only the findings of its own rules that are errors.
						new RsdoctorRspackPlugin({ disableClientServer: true, linter: { level: "Error" } }),
					],
				},
			},
		},
	});
	quiet.mockRestore();
}, 180_000);
afterAll(() => cleanBuild(build));

/** The loaders Rsdoctor timed, by file, from the data it wrote next to the output. */
function timedLoaders(): string[] {
	const folder = path.join(build.dist, "out", ".rsdoctor", "loader");
	return fs.readdirSync(folder).flatMap((file) => {
		const text = fs.readFileSync(path.join(folder, file), "utf8");
		// Boundary: Rsdoctor's own format, a compressed list of modules and the loaders they went through.
		const modules = JSON.parse(zlib.inflateSync(Buffer.from(text, "base64")).toString()) as {
			loaders: { loader: string }[];
		}[];
		return modules.flatMap((module) => module.loaders.map(({ loader }) => path.basename(loader)));
	});
}

describe("a build with Rsdoctor", () => {
	it("builds, with no message but the findings of Rsdoctor's own rules", () => {
		expect(build.error).toBe("");
		expect(build.ok).toBe(true);
		const messages = build.messages.split(/\n(?=WARNING in |ERROR in )/).filter(Boolean);
		expect(messages.filter((message) => !/^WARNING in ⚠ \[E\d+:Warn:/.test(message))).toEqual([]);
	});

	it("gives each thread its script, and the template the component's styles", () => {
		const { mainThread, background } = scriptsOf(build);
		expect(mainThread).toContain("lepus=true js=false");
		expect(background).toContain("lepus=false js=true");
		expect(JSON.stringify(readTemplate(build)["css"])).toContain("margin-top");
	});

	it("records the binding's loaders", () => {
		const loaders = new Set(timedLoaders());
		for (const loader of ["svelte-component.ts", "svelte-module.ts", "main-thread-functions.ts"])
			expect([...loaders]).toContain(loader);
	});
});
