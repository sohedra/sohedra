// Generated from @lynx-js/types 4.4.2 by `pnpm -F @sohedra/lynx generate`. Do not edit:
// change scripts/types/ and generate again. The doc comments are Lynx's, adapted from
// @lynx-js/types (Apache License 2.0).

/** The platforms Lynx runs on. `pc` is Lynx's older name for Windows and macOS. */
export type PlatformType = "Android" | "iOS" | "Harmony" | "windows" | "macOS" | "pc";

/** What Lynx says about the device and itself. */
export interface SystemInfo {
	/**
	 * The version of the Lynx Engine.
	 * @deprecated Use `engineVersion`.
	 * @example '2.4', '2.10'
	 */
	readonly lynxSdkVersion: string;
	/**
	 * The version of the Lynx Engine.
	 * @example '3.2'
	 */
	readonly engineVersion: string;
	/**
	 * The current operating system version.
	 * Not on the main thread.
	 */
	readonly osVersion: string;
	/** The physical pixel height of the real device. */
	readonly pixelHeight: number;
	/** The physical pixel width of the real device. */
	readonly pixelWidth: number;
	/** The physical pixel ratio of the real device. */
	readonly pixelRatio: number;
	/** The platform of the current device. */
	readonly platform: PlatformType;
	/**
	 * The JavaScript engine currently used.
	 * Not on the main thread: a template that shows it, or `osVersion`, is drawn without it in the first frame.
	 */
	readonly runtimeType: "v8" | "jsc" | "quickjs";
	/** The theme the host gave Lynx, if any. */
	readonly theme?: object;
}
