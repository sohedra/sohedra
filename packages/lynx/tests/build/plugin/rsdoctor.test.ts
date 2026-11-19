// One build with Rsdoctor, the build analyzer, which wraps each loader of the bundler's rules to
// time it: the binding's loaders work under its wrapper, and the component's CSS still reaches the
// template through the loader its import names (which Rsdoctor does not wrap). Rsdoctor never serves
// its report here, and opens no browser.

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import zlib from "node:zlib";

import { RsdoctorRspackPlugin } from "@rsdoctor/rspack-plugin";
import { afterAll, beforeAll, describe, expect, it, rs } from "@rstest/core";

import { buildApp, cleanBuild, readTemplate, scriptsOf } from "../build-app.ts";
import type { AppBuild } from "../build-app.ts";

let build: AppBuild;
let plugin: RsdoctorRspackPlugin<[]>;
let listened = 0;

/**
 * Rsdoctor with no server and no browser. It reads `disableClientServer` as it is made, and under
 * Rstest takes `false` whatever it is given (`@rsdoctor/core` 1.6.5,
 * `dist/inner-plugins/utils/config.js:102`: `'true' === process.env.RSTEST ? false : …`), so it is
 * made with `RSTEST` unset. Its SDK starts a server as the build starts, whatever the option, and
 * skips it only when it has none (`@rsdoctor/sdk` 1.6.5, `RsdoctorSDK.bootstrap`): its server is one
 * that never listens.
 *
 * @workaround rsdoctor-server-under-rstest kind=tooling delete-when="Rsdoctor honors disableClientServer under Rstest and starts no server with it"
 */
function quietRsdoctor(): RsdoctorRspackPlugin<[]> {
	const rstest = process.env["RSTEST"];
	delete process.env["RSTEST"];
	let made: RsdoctorRspackPlugin<[]>;
	try {
		// Only the findings of its own rules that are errors.
		made = new RsdoctorRspackPlugin({ disableClientServer: true, linter: { level: "Error" } });
	} finally {
		if (rstest !== undefined) process.env["RSTEST"] = rstest;
	}
	// Boundary: Rsdoctor's SDK keeps its server in a field its types leave out.
	(made.sdk as unknown as { server: unknown }).server = {
		origin: "",
		port: 0,
		socketUrl: { port: 0, socketUrl: "" },
		bootstrap: async () => {},
		dispose: async () => {},
		openClientPage: async () => {},
		sendAPIDataToClient: () => {},
		broadcast: () => {},
	};
	return made;
}

beforeAll(async () => {
	// Rsdoctor logs its every step while `DEBUG` is set, as the build tests set it.
	const log = console.log;
	const quiet = rs
		.spyOn(console, "log")
		.mockImplementation((...args: unknown[]) =>
			String(args[0]).includes("RSDOCTOR") ? undefined : log(...args),
		);
	const listen = net.Server.prototype.listen;
	const watch = rs.spyOn(net.Server.prototype, "listen").mockImplementation(function (
		this: net.Server,
		...args: unknown[]
	) {
		listened++;
		return Reflect.apply(listen, this, args) as net.Server;
	});
	try {
		plugin = quietRsdoctor();
		build = await buildApp("app", { rsbuild: { tools: { rspack: { plugins: [plugin] } } } });
	} finally {
		watch.mockRestore();
		quiet.mockRestore();
	}
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
	it("starts no server and opens no browser", () => {
		expect(plugin.options.disableClientServer).toBe(true);
		expect(listened).toBe(0);
	});

	it("builds, with no message but the findings of Rsdoctor's own rules", () => {
		expect(build.error).toBe("");
		expect(build.ok).toBe(true);
		// Without colors, which Rsdoctor adds where the terminal is said to take them (CI).
		const messages = stripVTControlCharacters(build.messages)
			.split(/\n(?=WARNING in |ERROR in )/)
			.filter(Boolean);
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
