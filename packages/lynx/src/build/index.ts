// Runs in Node, when an app is built: the plugin, the compiler passes and the test presets.

export { compileComponent } from "./compile/component.ts";
export type { CompiledComponent } from "./compile/component.ts";
export { compileRuneModule } from "./compile/rune-module.ts";
export { moduleFunctions } from "./main-thread-functions/script.ts";
export type { ModuleFunctions } from "./main-thread-functions/script.ts";
