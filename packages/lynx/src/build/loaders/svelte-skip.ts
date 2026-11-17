// The modules the JavaScript loaders leave alone: Svelte's own source, which the build compiles
// nothing in, and which a loader would otherwise read on every build.

/** Whether `resourcePath` is a file of Svelte's `src` folder (under any package manager's layout). */
export const isSvelteSource = (resourcePath: string): boolean =>
	/[\\/]node_modules[\\/]svelte[\\/]src[\\/]/.test(resourcePath);
