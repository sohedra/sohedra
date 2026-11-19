// A component's first-frame copy, which the test preset compiles for the main thread: calling it
// records how the page's first frame is drawn, with these props (an object, or a function of the
// page's data and the host's global props, as `mountPage` takes them) and this context.

declare module "*.svelte?first-frame" {
	const drawFirstFrame: (
		props?:
			| Record<string, unknown>
			| ((
					initData: Record<string, unknown>,
					globalProps: Record<string, unknown>,
			  ) => Record<string, unknown>),
		context?: Map<unknown, unknown>,
	) => void;
	export default drawFirstFrame;
}
