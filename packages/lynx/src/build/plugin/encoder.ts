// The template encoder the package carries.
//
// The template plugin (`@lynx-js/template-webpack-plugin`) pins an older `@lynx-js/tasm`, which
// encodes for Lynx 3.9 at most. This package builds for 4.2, so it depends on `@lynx-js/tasm`
// itself and hands that copy to the plugin's encode step. A pnpm override would do it too, but
// only the root project of an install reads one, so each app would have to add it.

import { buildError } from "../diagnostics/messages.ts";

/** What the engine's encoder says when it is too old for the engine version asked for. */
const TOO_OLD = /current compiler only support lynx version/;

/** The class members this file relies on. */
interface EncodePoolOwner {
	encodePool?: { run?: unknown };
}
type Run = (task: Record<string, unknown>, options?: unknown) => Promise<unknown>;

const HANDED_OVER = Symbol.for("@sohedra/lynx:encoder");

const cannotHandOver = (reason: string): Error =>
	buildError({ code: "encoder_not_handed_over", details: { reason } });

/**
 * Give every encode task the package's own encoder. Two things the template plugin does not
 * document are relied on (read in 0.16.8):
 *
 * - `LynxEncodePlugin.encodePool` is a public static pool, and the encode step calls
 *   `encodePool.run({ encodeOptions })`;
 * - its worker takes a `tasmPkg` field naming the module to encode with (default
 *   `@lynx-js/tasm`, resolved from the plugin's own place), and the plugin never sets it.
 *
 * If the pool is gone this throws; if the worker no longer takes the field, the engine refuses 4.2
 * and the refusal is rewritten, so the build never ends in the engine's bare `encode error`.
 *
 * @workaround encoder-handover kind=tooling delete-when="the template plugin depends on a @lynx-js/tasm that encodes for the oldest Lynx the binding builds for"
 */
export function handEncoderOver(plugin: EncodePoolOwner, tasmPkg: string): void {
	const pool = plugin.encodePool as { run?: Run; [HANDED_OVER]?: true } | undefined;
	if (typeof pool?.run !== "function") {
		throw cannotHandOver("its LynxEncodePlugin has no encodePool to run the encode step in");
	}
	// Set up again (another environment, a restart of the dev server): once is enough.
	if (pool[HANDED_OVER]) return;
	const run = pool.run.bind(pool) as Run;
	pool.run = async (task, options) => {
		try {
			return await run({ ...task, tasmPkg }, options);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			if (!TOO_OLD.test(message)) throw error;
			throw cannotHandOver(`the engine said: ${message.trim()}`);
		}
	};
	pool[HANDED_OVER] = true;
}

/** Hand the package's encoder to the template plugin installed beside it. */
export async function carryEncoder(): Promise<void> {
	const { LynxEncodePlugin } = await import("@lynx-js/template-webpack-plugin");
	handEncoderOver(LynxEncodePlugin, import.meta.resolve("@lynx-js/tasm"));
}
