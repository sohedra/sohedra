// A component's first-frame copy, which the test preset compiles for the main thread: calling it
// records how the page's first frame is drawn, with these props.

declare module "*.svelte?first-frame" {
	const drawFirstFrame: (props?: Record<string, unknown>) => void;
	export default drawFirstFrame;
}
