// The type of Lynx's `SystemInfo`, field for field as Lynx declares it, with its doc comments
// written anew. Compare it with that file when the engine moves.
//
// Adapted from Lynx's @lynx-js/types 4.4.7 (js_libraries/types/types/common/system-info.d.ts),
// Apache License 2.0.

/** The platforms Lynx runs on. `pc` is Lynx's older name for Windows and macOS. */
export type PlatformType = "Android" | "iOS" | "Harmony" | "windows" | "macOS" | "pc";

/** What Lynx says about the device and itself. */
export interface SystemInfo {
	/**
	 * The version of the Lynx engine, as `engineVersion` gives it; kept by Lynx for older code.
	 *
	 * @deprecated Use `engineVersion`.
	 */
	readonly lynxSdkVersion: string;
	/** The version of the Lynx engine: `"3.2"`. */
	readonly engineVersion: string;
	/** The version of the device's operating system. Not on the main thread. */
	readonly osVersion: string;
	/** The screen's height, in physical pixels. */
	readonly pixelHeight: number;
	/** The screen's width, in physical pixels. */
	readonly pixelWidth: number;
	/** How many physical pixels make one of Lynx's layout units. */
	readonly pixelRatio: number;
	/** The device's platform. */
	readonly platform: PlatformType;
	/**
	 * The JavaScript engine the background thread runs on. Not on the main thread: a template that
	 * shows it, or `osVersion`, is drawn without it in the first frame.
	 */
	readonly runtimeType: "v8" | "jsc" | "quickjs";
	/** The theme the host gave Lynx, if any. */
	readonly theme?: object;
}
