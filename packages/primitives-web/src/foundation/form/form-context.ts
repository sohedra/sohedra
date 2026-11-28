// The form contexts a control reads, typed for the web, and their null values. Core never reads a
// context. Field.Root sets the field's, Field.Root and Field.Item the labelable's, Fieldset.Root
// sets and reads the fieldset's.
import {
	type FieldRootView,
	type FieldsetView,
	type LabelableView,
	NULL_FIELD as CORE_NULL_FIELD,
} from "@sohedra/primitives-core/foundation/form";
import { defineContext } from "@sohedra/primitives-core/foundation/kernel";

import type { WebTypes } from "../kernel/index.js";

export { NULL_FIELDSET, NULL_LABELABLE } from "@sohedra/primitives-core/foundation/form";

/** The field a control sits in: Field.Root sets its store. */
export const FieldRootContext = defineContext<FieldRootView<WebTypes>>("Field.Root");

/** The labelable a control sits in: Field.Root and Field.Item set their stores. */
export const LabelableContext = defineContext<LabelableView>("Field.Root");

/** The fieldset a part sits in: Fieldset.Root sets its store. */
export const FieldsetRootContext = defineContext<FieldsetView>("Fieldset.Root");

/**
 * The field a control sees outside `Field.Root`. Core's null field is typed for any platform; it
 * holds no element and calls nothing, so it is the web's too.
 */
export const NULL_FIELD = CORE_NULL_FIELD as FieldRootView<WebTypes>;
