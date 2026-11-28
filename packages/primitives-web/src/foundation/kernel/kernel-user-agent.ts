function readNavigator() {
	if (typeof navigator === "undefined") {
		return { userAgent: "", platform: "", maxTouchPoints: 0 };
	}
	return {
		userAgent: navigator.userAgent.toLowerCase(),
		platform: (navigator.platform ?? "").toLowerCase(),
		maxTouchPoints: navigator.maxTouchPoints ?? 0,
	};
}

const { userAgent: agent, platform: navigatorPlatform, maxTouchPoints } = readNavigator();

const webkit = typeof CSS !== "undefined" && !!CSS.supports?.("-webkit-backdrop-filter:none");
// Engines are mutually exclusive: Firefox on iOS is WebKit.
const gecko = !webkit && agent.includes("firefox");
const ios =
	/^i(os$|p)/.test(navigatorPlatform) || (navigatorPlatform === "macintel" && maxTouchPoints > 1);
const android = navigatorPlatform === "android" || agent.includes("android");
const mac = !ios && navigatorPlatform.startsWith("mac");

/** Static user-agent traits, evaluated once (all `false` on the server). */
export const userAgent = {
	engine: { webkit, gecko },
	os: { ios, android, mac, apple: mac || ios },
	screenReader: { voiceOver: mac || ios },
} as const;
