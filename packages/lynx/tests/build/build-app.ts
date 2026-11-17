// Builds a fixture app in this process, through Rsbuild and `pluginSvelteLynx`, and reads what the
// build leaves. One build at a time on the machine: a lock keeps two test files from building at
// once, and every build test goes through here.
//
// The runtime behind the compiled code's imports is not in this package yet, so a build aliases
// them to the stubs in tests/fixtures/build/stubs: they let the build resolve; nothing runs.

import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";

import { createRsbuild } from "@rsbuild/core";
import type { Rspack, RsbuildConfig } from "@rsbuild/core";

import { pluginSvelteLynx } from "../../src/build/plugin/index.ts";
import type { PluginSvelteLynxOptions } from "../../src/build/plugin/index.ts";
import { RUNTIME_FILES } from "../../src/build/plugin/layers.ts";
import { PACKAGE_NAME } from "../../src/wire/index.ts";

const FIXTURES = path.resolve(import.meta.dirname, "../fixtures/build");

/** What a build is asked for. */
export interface BuildAppOptions {
	/** The options of `pluginSvelteLynx`. */
	plugin?: PluginSvelteLynxOptions;
	/** Rsbuild's config, merged over the test's own. */
	rsbuild?: RsbuildConfig;
	/** The entry file in the app's folder. */
	entry?: string;
	/** A development build. */
	development?: boolean;
	/**
	 * Build a copy of the app outside this package's folder, with only Svelte linked in: an app that
	 * has no dependency of its own on `@sohedra/lynx`, which no folder above it brings either.
	 */
	outside?: boolean;
	/** Who runs the build: `rstest` makes it a test run, without the Lynx engine. */
	callerName?: string;
	/** Files written into the app's copy, by path: for the ones no formatter may read (a component that does not compile). Implies `outside`. */
	files?: Record<string, string>;
}

/** What a build left. */
export interface AppBuild {
	/** Whether it built. */
	ok: boolean;
	/** The error's text when it did not. */
	error: string;
	/** The build's warnings and errors, as the bundler printed them. */
	messages: string;
	/** The output folder. */
	dist: string;
}

const STUBS = path.join(FIXTURES, "stubs");
const ALIASES: Record<string, string> = {
	[`${PACKAGE_NAME}/internal/renderer`]: path.join(STUBS, "renderer.ts"),
	[`${PACKAGE_NAME}/internal/main-thread-functions`]: path.join(STUBS, "main-thread-functions.ts"),
	[`${PACKAGE_NAME}/internal/window-size`]: path.join(STUBS, "window-size.ts"),
	[RUNTIME_FILES.serverInternals]: path.join(STUBS, "server-internals.ts"),
	[RUNTIME_FILES.clientInternals]: path.join(STUBS, "client-internals.ts"),
};

const LOCK = path.join(os.tmpdir(), "sohedra-lynx-build.lock");

/** Wait for the machine's one build slot; a lock of a dead process is taken over. */
async function lock(): Promise<() => void> {
	for (;;) {
		try {
			fs.mkdirSync(LOCK);
			fs.writeFileSync(path.join(LOCK, "pid"), String(process.pid));
			return () => fs.rmSync(LOCK, { recursive: true, force: true });
		} catch {
			try {
				const pid = Number(fs.readFileSync(path.join(LOCK, "pid"), "utf8"));
				process.kill(pid, 0);
			} catch {
				fs.rmSync(LOCK, { recursive: true, force: true });
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}
}

/** The folder of fixture app `app`. */
export const appFolder = (app: string): string => path.join(FIXTURES, "apps", app);

/** A copy of the fixture app in `under`, with Svelte's package linked into its `node_modules`. */
function copyOutside(app: string, under: string, files: Record<string, string> = {}): string {
	const folder = path.join(under, "app");
	fs.cpSync(appFolder(app), folder, { recursive: true });
	fs.mkdirSync(path.join(folder, "node_modules"));
	const svelte = path.dirname(createRequire(import.meta.url).resolve("svelte/package.json"));
	fs.symlinkSync(svelte, path.join(folder, "node_modules", "svelte"), "dir");
	for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(folder, name), text);
	return folder;
}

/** Build fixture app `app` into a folder of its own, and say how it went. */
export async function buildApp(app: string, options: BuildAppOptions = {}): Promise<AppBuild> {
	const release = await lock();
	const dist = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-lynx-dist-"));
	const cwd =
		options.outside || options.files ? copyOutside(app, dist, options.files) : appFolder(app);
	// `DEBUG=lynx` keeps each thread's script in `.lynx/<entry>/`, where the tests read them; and
	// `process.env.DEBUG` in the fixtures is replaced by it.
	const previous = process.env["DEBUG"];
	process.env["DEBUG"] = "lynx";
	try {
		const rsbuild = await createRsbuild({
			cwd,
			...(options.callerName !== undefined && { callerName: options.callerName }),
			config: {
				mode: options.development ? "development" : "production",
				source: { entry: { main: options.entry ?? "./index.ts" } },
				resolve: { alias: ALIASES },
				plugins: [pluginSvelteLynx(options.plugin)],
				...options.rsbuild,
				output: {
					distPath: { root: path.join(dist, "out") },
					cleanDistPath: false,
					...options.rsbuild?.output,
				},
			},
		});
		// Run the compiler itself: a failed `rsbuild.build()` throws a short error, and the stats
		// hold what the bundler printed.
		const compiler = await rsbuild.createCompiler();
		const stats = await new Promise<Rspack.Stats | Rspack.MultiStats | undefined>(
			(resolve, reject) => {
				compiler.run((error, result) => (error ? reject(error) : resolve(result)));
			},
		);
		await new Promise<void>((resolve) => compiler.close(() => resolve()));
		const messages = stats?.toString({ all: false, errors: true, warnings: true }) ?? "";
		return { ok: stats?.hasErrors() === false, error: "", messages, dist };
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error),
			messages: "",
			dist,
		};
	} finally {
		if (previous === undefined) delete process.env["DEBUG"];
		else process.env["DEBUG"] = previous;
		release();
	}
}

/** Remove a build's output. */
export function cleanBuild(build: AppBuild): void {
	fs.rmSync(build.dist, { recursive: true, force: true });
}

/** The scripts of a build's entry, as the engine kept them. */
export function scriptsOf(
	build: AppBuild,
	entry = "main",
): { mainThread: string; background: string } {
	const folder = path.join(build.dist, "out", ".lynx", entry);
	const files = fs.readdirSync(folder);
	const background = files.find((name) => name.startsWith("background") && name.endsWith(".js"));
	return {
		mainThread: fs.readFileSync(path.join(folder, "main-thread.js"), "utf8"),
		background: fs.readFileSync(path.join(folder, background ?? "background.js"), "utf8"),
	};
}

/** The template the engine encoded, parsed. */
// oxlint-disable-next-line typescript/no-explicit-any -- the encoded template is read by key, as the engine writes it
export function readTemplate(build: AppBuild, entry = "main"): Record<string, any> {
	return JSON.parse(
		fs.readFileSync(path.join(build.dist, "out", ".lynx", entry, "tasm.json"), "utf8"),
	);
}
