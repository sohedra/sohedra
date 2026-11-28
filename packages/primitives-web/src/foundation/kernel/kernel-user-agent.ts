interface Traits {
	readonly webkit: boolean;
	readonly gecko: boolean;
	readonly ios: boolean;
	readonly android: boolean;
	readonly mac: boolean;
}

let traits: Traits | undefined;

// Read on first use, not when the module loads: importing the package touches no browser API.
function read(): Traits {
	if (traits) {
		return traits;
	}
	const agent = typeof navigator === "undefined" ? "" : navigator.userAgent.toLowerCase();
	const platform = typeof navigator === "undefined" ? "" : (navigator.platform ?? "").toLowerCase();
	const maxTouchPoints = typeof navigator === "undefined" ? 0 : (navigator.maxTouchPoints ?? 0);
	const webkit = typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-backdrop-filter:none");
	const ios = /^i(os$|p)/.test(platform) || (platform === "macintel" && maxTouchPoints > 1);
	traits = {
		webkit,
		// Engines are mutually exclusive: Firefox on iOS is WebKit.
		gecko: !webkit && agent.includes("firefox"),
		ios,
		android: platform === "android" || agent.includes("android"),
		mac: !ios && platform.startsWith("mac"),
	};
	return traits;
}

/** Static user-agent traits, read once on first use (all `false` on the server). */
export const userAgent = {
	engine: {
		get webkit(): boolean {
			return read().webkit;
		},
		get gecko(): boolean {
			return read().gecko;
		},
	},
	os: {
		get ios(): boolean {
			return read().ios;
		},
		get android(): boolean {
			return read().android;
		},
		get mac(): boolean {
			return read().mac;
		},
		get apple(): boolean {
			return read().mac || read().ios;
		},
	},
	screenReader: {
		get voiceOver(): boolean {
			return read().mac || read().ios;
		},
	},
} as const;
