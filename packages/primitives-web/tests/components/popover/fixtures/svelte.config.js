// The `popover-late-*.svelte` fixtures use `await` in markup, which compiles only with Svelte's
// `experimental.async`. svelte-check (`pnpm check`) reads this file for the fixtures in this
// folder; Vite reads the package's vite.config.ts, which turns async on in `--mode async`, the
// only mode that runs the `*.async.test.ts` files importing those fixtures.
export default {
	compilerOptions: {
		runes: true,
		experimental: { async: true },
	},
};
