// Runs in Node, when an app is built: the plugin, the compiler passes and the test presets.

export { compileComponent } from "./compile/component.ts";
export type { CompiledComponent, ComponentOptions } from "./compile/component.ts";
export { compileRuneModule } from "./compile/rune-module.ts";
export type { CompiledModule, ModuleOptions } from "./compile/rune-module.ts";
export { BUILD_CATALOGUE } from "./diagnostics/catalogue.ts";
export type { BuildCode, BuildDetails } from "./diagnostics/catalogue.ts";
export type { BuildError, BuildWarning } from "./diagnostics/messages.ts";
export { hasMainThreadFunction } from "./main-thread-functions/directive.ts";
export { moduleFunctions } from "./main-thread-functions/script.ts";
export type { FunctionOptions, ModuleFunctions } from "./main-thread-functions/script.ts";
export { compose } from "./source-map/maps.ts";
export type { InputMap, SourceMap } from "./source-map/maps.ts";
