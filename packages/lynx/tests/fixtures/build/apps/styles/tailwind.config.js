// The utilities the page's components use, and nothing of Tailwind's base styles.
export default {
	content: { relative: true, files: ["./*.svelte"] },
	corePlugins: { preflight: false },
};
