// The form contexts a control reads, typed for the web, and the null values it reads outside each.
// Core never reads a context. Field.Root sets `FieldRootContext`; Field.Root and Field.Item set
// `LabelableContext`; Fieldset.Root sets and reads `FieldsetRootContext`. Every field-aware control
// reads them.
import {
	type FieldRootView,
	type FieldsetView,
	type LabelableView,
	NULL_FIELD as CORE_NULL_FIELD,
} from "@sohedra/primitives-core/foundation/form/index.js";
import { defineContext } from "@sohedra/primitives-core/foundation/kernel/index.js";

import type { WebTypes } from "../kernel/index.js";

export { NULL_FIELDSET, NULL_LABELABLE } from "@sohedra/primitives-core/foundation/form/index.js";

/** The field a control sits in: Field.Root sets its store. */
export const FieldRootContext = defineContext<FieldRootView<WebTypes>>(
	"FieldRootContext",
	"Field parts must be placed within <Field.Root>.",
);

/** The labelable scope a control sits in: Field.Root and Field.Item set their stores. */
export const LabelableContext = defineContext<LabelableView>(
	"LabelableContext",
	"Labelable parts must be placed within a labelable provider.",
);

/** The fieldset a part sits in: Fieldset.Root sets its store. */
export const FieldsetRootContext = defineContext<FieldsetView>(
	"FieldsetRootContext",
	"Fieldset parts must be placed within <Fieldset.Root>.",
);

/**
 * The field a control sees outside `Field.Root`. Core's null field is typed for any platform; it
 * holds no element and calls nothing, so it is the web's too.
 */
export const NULL_FIELD = CORE_NULL_FIELD as FieldRootView<WebTypes>;
