// The package as an app gets it: packed as it is published, installed into a fresh app
// (tests/fixtures/consumer) with one package manager, then the app's production build and its tests
// under both test presets. CI runs it with pnpm on each Node.js line the package supports, with each
// other package manager it supports on the newest line, with pnpm on Windows, and once at the floor
// of every range.
//
//   node scripts/consumer.ts --manager <pnpm|npm|yarn|bun> [--versions newest|floor]
//                            [--tarball <file or folder>] [--keep]
//
// `--versions newest` (the default) installs what each range resolves to today. `--versions floor`
// installs each peer, and each dependency of the package, at the lowest version its range allows
// (pnpm only), and checks that each is. `--tarball` installs a package packed before (`pnpm pack`;
// the file, or a folder holding one), where this script would build and pack it itself: CI packs
// with the repository's Node.js and runs the app on another.
//
// The app is made in a new folder of the system's temporary folder, outside this repository so that
// nothing resolves from its `node_modules`, and removed after a pass unless `--keep` is given.

import { spawnSync } from "node:child_process";
import type { StdioOptions } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const ROOT = path.resolve(import.meta.dirname, "..");
const APP_FIXTURE = path.join(ROOT, "tests/fixtures/consumer");
/** Yarn, run from npm's registry: its `node-modules` linker, as the package supports. */
const YARN = "4.18.1";

interface Manager {
	/** The command and its first arguments. */
	command: string[];
	/** The arguments of an install with no lockfile. */
	install: string[];
	/** Files the manager reads in the app, by name. */
	files?: Record<string, string>;
}

const MANAGERS: Record<string, Manager> = {
	pnpm: { command: ["pnpm"], install: ["install", "--no-frozen-lockfile"] },
	npm: { command: ["npm"], install: ["install", "--no-audit", "--no-fund"] },
	yarn: {
		command: ["npm", "exec", "--yes", `--package=@yarnpkg/cli-dist@${YARN}`, "--", "yarn"],
		install: ["install"],
		files: {
			// Plug'n'Play is not supported: the app gets a `node_modules` folder. CI forbids a new
			// lockfile unless told otherwise, and this app has none.
			".yarnrc.yml":
				"nodeLinker: node-modules\nenableImmutableInstalls: false\nenableTelemetry: false\n",
		},
	},
	bun: { command: ["bun"], install: ["install"] },
};

interface Manifest {
	name: string;
	dependencies: Record<string, string>;
	devDependencies: Record<string, string>;
	peerDependencies: Record<string, string>;
}

/** The lowest version `range` allows, for the ranges the package writes: `^1.2.3` or `1.2.3`. */
function floorOf(name: string, range: string): string {
	const floor = /^\^?(\d+\.\d+\.\d+)$/.exec(range)?.[1];
	if (floor === undefined)
		throw new Error(
			`${name}'s range ${range} has no floor to install. Write it as ^x.y.z, from the version tested.`,
		);
	return floor;
}

/** An argument as `cmd.exe` reads it: quoted, its quotes doubled. */
const quoted = (argument: string): string => `"${argument.replaceAll('"', '""')}"`;

/** Run `command` in `cwd`; throws when it fails. Its output is shown, and returned when `capture`. */
function run(command: string[], cwd: string, capture = false): string {
	console.log(`\n> ${command.join(" ")}   (in ${cwd})`);
	const [file, ...args] = command;
	const stdio: StdioOptions = capture ? ["inherit", "pipe", "pipe"] : "inherit";
	// On Windows, npm is a `.cmd` script, which only `cmd.exe` starts; pnpm and Bun are programs.
	const result =
		process.platform === "win32" && file !== "pnpm" && file !== "bun"
			? spawnSync(
					process.env["ComSpec"] ?? "cmd.exe",
					["/d", "/s", "/c", `"${command.map(quoted).join(" ")}"`],
					{ cwd, stdio, windowsVerbatimArguments: true, encoding: "utf8" },
				)
			: spawnSync(file!, args, { cwd, stdio, encoding: "utf8" });
	if (capture) process.stdout.write(`${result.stdout}${result.stderr}`);
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(`${command.join(" ")} exited with ${result.status}.`);
	return capture ? `${result.stdout}${result.stderr}` : "";
}

/** Build the package and pack it into `folder`, as it is published; returns the tarball. */
function pack(folder: string): string {
	fs.rmSync(path.join(ROOT, "lib"), { recursive: true, force: true });
	run(["pnpm", "run", "build"], ROOT);
	run(["pnpm", "pack", "--pack-destination", folder], ROOT);
	return tarballIn(folder);
}

/** The one tarball in `folder`. */
function tarballIn(folder: string): string {
	const tarballs = fs.readdirSync(folder).filter((name) => name.endsWith(".tgz"));
	if (tarballs.length !== 1)
		throw new Error(`${folder} holds ${tarballs.length} tarballs; pack the package there once.`);
	return path.join(folder, tarballs[0]!);
}

/** The app's manifest: the fixture's, with the packed package, Svelte, and every peer the app needs. */
function appManifest(options: {
	own: Manifest;
	tarball: string;
	floor: boolean;
}): Record<string, unknown> {
	const { own, tarball, floor } = options;
	// Boundary: JSON has no type; the fixture's manifest has these fields.
	const fixture = JSON.parse(
		fs.readFileSync(path.join(APP_FIXTURE, "package.json"), "utf8"),
	) as Record<string, unknown> & { devDependencies: Record<string, string> };
	const peers = Object.entries(own.peerDependencies).filter(([name]) => name !== "svelte");
	return {
		...fixture,
		dependencies: {
			[own.name]: `file:${tarball}`,
			// The custom-renderer build is not on npm's registry yet: an app installs it by its URL.
			svelte: own.devDependencies["svelte"],
		},
		devDependencies: {
			// What the app has besides the package's peers: TypeScript, for its config files.
			...fixture.devDependencies,
			...Object.fromEntries(
				peers.map(([name, range]) => [name, floor ? floorOf(name, range) : range]),
			),
		},
	};
}

/** pnpm's settings that hold each dependency of the package at its floor. */
function floorOverrides(own: Manifest): string {
	const overrides = Object.fromEntries(
		Object.entries(own.dependencies).map(([name, range]) => [
			`${own.name}>${name}`,
			floorOf(name, range),
		]),
	);
	// JSON is YAML too.
	return `${JSON.stringify({ overrides }, null, "\t")}\n`;
}

/** The version of package `name` that code in `folder` loads, as Node finds it. */
function versionFrom(folder: string, name: string): string | undefined {
	for (let at = folder; ; at = path.dirname(at)) {
		const manifest = path.join(at, "node_modules", name, "package.json");
		// Boundary: JSON has no type; a manifest has a version.
		if (fs.existsSync(manifest))
			return (JSON.parse(fs.readFileSync(manifest, "utf8")) as { version: string }).version;
		if (path.dirname(at) === at) return undefined;
	}
}

/** Throws unless the app has each peer, and the package each dependency, at its floor. */
function checkFloors(own: Manifest, app: string): void {
	const installed = fs.realpathSync(path.join(app, "node_modules", own.name));
	const wanted = [
		...Object.entries(own.peerDependencies)
			.filter(([name]) => name !== "svelte")
			.map(([name, range]) => ({ name, range, from: app })),
		...Object.entries(own.dependencies).map(([name, range]) => ({ name, range, from: installed })),
	];
	const off = wanted.flatMap(({ name, range, from }) => {
		const version = versionFrom(from, name);
		return version === floorOf(name, range)
			? []
			: [`${name} ${version ?? "missing"} (floor ${floorOf(name, range)})`];
	});
	if (off.length > 0) throw new Error(`The install is not at the floors:\n- ${off.join("\n- ")}`);
	console.log(`\nEach of ${wanted.length} packages is at its floor.`);
}

function main(): void {
	const { values } = parseArgs({
		options: {
			manager: { type: "string" },
			versions: { type: "string", default: "newest" },
			tarball: { type: "string" },
			keep: { type: "boolean", default: false },
		},
	});
	const manager = MANAGERS[values.manager ?? ""];
	if (manager === undefined)
		throw new Error(`Name the package manager: --manager ${Object.keys(MANAGERS).join("|")}.`);
	if (values.versions !== "newest" && values.versions !== "floor")
		throw new Error(`--versions is newest or floor, not ${values.versions}.`);
	const floor = values.versions === "floor";
	if (floor && values.manager !== "pnpm")
		throw new Error("--versions floor runs with pnpm, whose overrides hold the floors.");
	// Boundary: JSON has no type; the package's manifest has these fields.
	const own = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")) as Manifest;

	const work = fs.mkdtempSync(path.join(os.tmpdir(), "sohedra-consumer-"));
	const app = path.join(work, "app");
	const given = values.tarball === undefined ? undefined : path.resolve(values.tarball);
	const tarball =
		given === undefined ? pack(work) : fs.statSync(given).isDirectory() ? tarballIn(given) : given;
	fs.cpSync(APP_FIXTURE, app, { recursive: true });
	fs.writeFileSync(
		path.join(app, "package.json"),
		`${JSON.stringify(appManifest({ own, tarball, floor }), null, "\t")}\n`,
	);
	for (const [name, text] of Object.entries(manager.files ?? {}))
		fs.writeFileSync(path.join(app, name), text);
	if (floor) fs.writeFileSync(path.join(app, "pnpm-workspace.yaml"), floorOverrides(own));

	run([...manager.command, ...manager.install], app);
	if (floor) checkFloors(own, app);
	const built = run([...manager.command, "run", "build"], app, true);
	const bundle = path.join(app, "dist/main.lynx.bundle");
	if (!fs.existsSync(bundle)) throw new Error(`The build wrote no ${bundle}.`);
	// The app's main-thread function is TypeScript: its types are taken out with Node's own
	// stripper, which must run on this Node.js line without saying it is experimental.
	if (built.includes("stripTypeScriptTypes"))
		throw new Error("The build printed a warning about Node.js's type stripper.");
	run([...manager.command, "run", "test:rstest"], app);
	run([...manager.command, "run", "test:vitest"], app);

	if (values.keep) console.log(`\nThe app is kept in ${app}.`);
	else fs.rmSync(work, { recursive: true, force: true });
	console.log(`\nThe packed package builds and tests with ${values.manager} (${values.versions}).`);
}

main();
