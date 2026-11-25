// Checked by `pnpm check`, not run. The test library's fakes stand in for what each thread's
// `globals.ts` says Lynx provides: the engine fake for the main thread's element functions, and the
// test page's `lynx` for each thread's. Each takes every argument its thread may pass and answers
// what its thread expects, so a change on either side that the other lacks fails to compile.

import type { BackgroundGlobals } from "../../../src/background/globals.ts";
import type { MainThreadGlobals } from "../../../src/main-thread/globals.ts";
import type { ElementFunctions } from "../../../src/testing/engine/create-engine.ts";
import type { LynxElement } from "../../../src/testing/engine/types.ts";
import type { BackgroundLynx, MainThreadLynx } from "../../../src/testing/page/lynx.ts";

/**
 * A function type, whose parameters are checked strictly: TypeScript checks a method's both ways,
 * so a fake that refuses an argument the thread passes would still match.
 */
type Strict<F> = F extends (...args: infer Args) => infer Returned
	? (...args: Args) => Returned
	: F;

/** Each member of `T`, its methods as strict function types; an optional member stays optional. */
type StrictMembers<T> = { [Name in keyof T]: Strict<T[Name]> };

/**
 * The fake's side of `StrictMembers`: a second alias, as TypeScript compares two uses of one alias
 * by its variance, with methods' parameters both ways.
 */
type StrictFake<T> = { [Name in keyof T]: Strict<T[Name]> };

/**
 * An element of the engine fake, as the main thread types every element: the main thread passes
 * back only the elements the engine made.
 */
type AsMainThreadElement<T> = T extends LynxElement ? object : T;

/** The engine fake's functions, taking elements as the main thread types them. */
type EngineFake = {
	[Name in keyof ElementFunctions]: ElementFunctions[Name] extends (
		...args: infer Args
	) => infer Returned
		? (...args: { [At in keyof Args]: AsMainThreadElement<Args[At]> }) => Returned
		: never;
};

/** Lynx's element functions as the main thread declares them: all but `lynx` and the standard ones. */
type ElementFunctionsPort = StrictMembers<
	Omit<MainThreadGlobals, "lynx" | "_ReportError" | "FinalizationRegistry">
>;

export const engineFake = (fake: EngineFake): ElementFunctionsPort => fake;
export const mainThreadLynx = (
	fake: StrictFake<MainThreadLynx>,
): StrictMembers<MainThreadGlobals["lynx"]> => fake;
export const backgroundLynx = (
	fake: StrictFake<BackgroundLynx>,
): StrictMembers<BackgroundGlobals["lynx"]> => fake;

/** The functions the engine fake has and the main thread does not declare. */
type Undeclared = Exclude<keyof ElementFunctions, keyof MainThreadGlobals>;

/** None: a function the main thread never calls has no stand-in to keep faithful. */
export const undeclared: [Undeclared] extends [never] ? "none" : Undeclared = "none";
