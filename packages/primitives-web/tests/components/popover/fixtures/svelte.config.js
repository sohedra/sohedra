// The `popover-late-*.svelte` fixtures use `await` in markup, which needs Svelte's
// `experimental.async`. Only svelte-check (`pnpm check`) reads this file; the tests compile them
// with vite.config.ts, which turns async on in `--mode async`, the only mode that imports them.
export default {
	compilerOptions: {
		runes: true,
		experimental: { async: true },
	},
};
