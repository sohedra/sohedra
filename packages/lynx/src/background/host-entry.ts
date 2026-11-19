// `@sohedra/lynx/host` on the background: what the native host gives the page, its data, its events
// and the keyboard. Its main-thread side, which components import as they draw the first frame, is
// ../first-frame/host-entry.ts.

export { globalProps, initData, systemInfo } from "./host/data.ts";
export type { GlobalProps, InitData } from "./host/data.ts";
export { host } from "./host/events.ts";
export type { Host, HostEvents, HostListener } from "./host/events.ts";
export { keyboard } from "./host/keyboard.ts";
export type { KeyboardState } from "./host/keyboard.ts";
export type { PlatformType, SystemInfo } from "./host/system-info.ts";
