// Checked by `pnpm check`, not run. A main-thread ref is a type with a brand: only
// `mainThreadRef` makes one, its value is `current`, and how it crosses stays hidden.

import { mainThreadRef } from "@sohedra/lynx";
import type { MainThreadRef } from "@sohedra/lynx";

const open: MainThreadRef<boolean> = mainThreadRef(false);
const empty: MainThreadRef<number | undefined> = mainThreadRef<number>();
const value: boolean = open.current;
void [empty, value];

// @ts-expect-error a plain object with `current` is not a ref.
const plain: MainThreadRef<boolean> = { current: true };
// @ts-expect-error the id it crosses with is not part of its type.
void open._wvid;
// @ts-expect-error nor is its initial value.
void open._initValue;
// @ts-expect-error nor its JSON.
void open.toJSON;
void plain;
