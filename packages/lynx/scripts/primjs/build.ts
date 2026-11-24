// Builds PrimJS, the engine of both of Lynx's threads, for this computer (macOS or Linux), as each
// Lynx the binding supports ships it: from the commit that Lynx's PrimJS release was built from, and
// with the phone's flags. The binaries run the polyfill folder's suites (tests/polyfill/).
//
// The phone's flags: Lynx compiles PrimJS with `LYNX_SIMPLIFY=0`, which leaves out the Unicode tables
// (`CONFIG_ALL_UNICODE`), and with them `String.prototype.normalize` and RegExp `\p{…}`; and with
// `ENABLE_LEPUSNG` (PrimJS's podspec and Android build). PrimJS's own shell needs `LYNX_SIMPLIFY`
// for its file loading, so the build turns it on and takes the tables out again with a header it
// includes first. The phone's snapshot interpreter and tracing GC are arm64 assembly and memory
// management, which a host build leaves out.
//
// The shell is ours (host.cc), built in place of PrimJS's `qjs`. Each build goes in the package's
// cache, by commit, and is made again when the shell or the flags change:
// `node scripts/primjs/build.ts`.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CACHE, checkOut } from "./checkout.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** A PrimJS build: the Lynx release that ships it, and where its source is. */
export interface Engine {
	/** The name the suites give it: the Lynx minor. */
	name: string;
	/** The Lynx release. */
	lynx: string;
	/** The PrimJS release Lynx's iOS pod and Android Maven package name. */
	release: string;
	/** The PrimJS commit that release was built from: the source built here. */
	commit: string;
	/** The PrimJS commit Lynx's own source pins (`dependencies/revision.py`), for the record. */
	lynxPin: string;
}

/**
 * The engines of the oldest and the newest Lynx the binding supports (`engine-version.ts`).
 *
 * Lynx 4.2.0 pins PrimJS `46ad1005` in its source, but its iOS pod and Android package are PrimJS
 * 4.2.1, which CocoaPods' spec builds from `03779eb6`: 20 commits later, with "Handle null in
 * nullish coalescing expressions", which phones show. Lynx 4.3.0-rc.1's pod, PrimJS 4.5.0-alpha.5
 * (lynx-family/Specs), builds from the commit its source pins.
 */
export const ENGINES: readonly Engine[] = [
	{
		name: "4.2",
		lynx: "4.2.0",
		release: "4.2.1",
		commit: "03779eb6fc5f51d95092e8c017ac33347740d86e",
		lynxPin: "46ad1005ab517638f980c0cb44294722c7a5d853",
	},
	{
		name: "4.3",
		lynx: "4.3.0-rc.1",
		release: "4.5.0-alpha.5",
		commit: "1617842c64d6901494fa0363f8fcd2690fd57446",
		lynxPin: "1617842c64d6901494fa0363f8fcd2690fd57446",
	},
];

const PRIMJS_URL = "https://github.com/lynx-family/primjs.git";

/** CMake's options: PrimJS's shell (`ENABLE_UNITTESTS`) and LepusNG, as phones have it. */
const CMAKE_OPTIONS = [
	"-DCMAKE_BUILD_TYPE=Release",
	"-DCMAKE_C_COMPILER=clang",
	"-DCMAKE_CXX_COMPILER=clang++",
	"-DENABLE_UNITTESTS=ON",
	"-DENABLE_LEPUSNG=ON",
];

/** The header every file includes first: the Unicode tables out, as `LYNX_SIMPLIFY=0` has them. */
function unicodeOff(source: string): string {
	const header = path.join(source, "src/interpreter/quickjs/include/libunicode.h");
	return `#include "${header}"\n#undef CONFIG_ALL_UNICODE\n`;
}

/** What makes a build: its commit, the shell and the flags. */
function buildKey(engine: Engine): string {
	return crypto
		.createHash("sha256")
		.update(engine.commit)
		.update(fs.readFileSync(path.join(HERE, "host.cc")))
		.update(CMAKE_OPTIONS.join(" "))
		.update(unicodeOff(""))
		.digest("hex");
}

/** Where `engine`'s builds go. */
function engineFolder(engine: Engine): string {
	return path.join(CACHE, "primjs", engine.commit);
}

/** The path of `engine`'s binary, built or not. */
export function enginePath(engine: Engine): string {
	return path.join(engineFolder(engine), "primjs");
}

/** Builds `engine`, unless its build is current, and returns the binary's path. */
export function buildEngine(engine: Engine): string {
	const folder = engineFolder(engine);
	const binary = enginePath(engine);
	const stamp = path.join(folder, "build-key");
	const key = buildKey(engine);
	if (fs.existsSync(binary) && fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === key)
		return binary;
	if (process.platform !== "darwin" && process.platform !== "linux")
		throw new Error(`PrimJS builds here on macOS and Linux, not ${process.platform}.`);

	const source = checkOut(path.join(folder, "source"), { url: PRIMJS_URL, commit: engine.commit });
	fs.copyFileSync(path.join(HERE, "host.cc"), path.join(source, "testing/quickjs/compiler/qjs.cc"));
	const build = path.join(folder, "build");
	fs.rmSync(build, { recursive: true, force: true });
	fs.mkdirSync(build, { recursive: true });
	const header = path.join(build, "unicode-off.h");
	fs.writeFileSync(header, unicodeOff(source));
	// CMake and the compiler print pages of warnings; they are shown only when the build fails.
	const run = (args: string[]): void => {
		try {
			execFileSync("cmake", args, { cwd: build, stdio: "pipe", maxBuffer: 64 * 1024 * 1024 });
		} catch (error) {
			// Boundary: execFileSync's error carries the process's output.
			const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
			const output = `${stdout?.toString() ?? ""}${stderr?.toString() ?? ""}`.slice(-20_000);
			throw new Error(
				`Building PrimJS ${engine.commit} failed: cmake ${args.join(" ")}\n${output}`,
			);
		}
	};
	run(["-S", source, "-B", build, ...CMAKE_OPTIONS, `-DCMAKE_CXX_FLAGS=-include ${header}`]);
	run(["--build", build, "--target", "qjs", "--parallel", String(os.availableParallelism())]);
	fs.copyFileSync(path.join(build, "qjs"), binary);
	fs.writeFileSync(stamp, key);
	return binary;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	for (const engine of ENGINES) {
		const started = performance.now();
		const binary = buildEngine(engine);
		const seconds = ((performance.now() - started) / 1000).toFixed(1);
		console.log(
			`PrimJS for Lynx ${engine.lynx} (${engine.commit.slice(0, 8)}): ${binary}, ${seconds} s`,
		);
	}
}
