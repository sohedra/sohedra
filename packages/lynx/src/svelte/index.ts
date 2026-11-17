// The face of src/svelte/: the manifest of every place the binding touches Svelte. The other
// folders reach Svelte's compiler and internals only through svelte/build/ and svelte/runtime/.

export { SVELTE_CONTRACT } from "./manifest.ts";
export type { ContractProgram, ContractRow } from "./manifest.ts";
