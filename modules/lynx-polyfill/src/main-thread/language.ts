// `@sohedra/lynx-polyfill/language` on the main thread: The language through ES2025 that Lynx's
// engine lacks or gets wrong: core-js's light fills and the own fixes behind behavior checks.

import {
	fillArrayMethods,
	fillBigIntAsUintN,
	fillErrorCause,
	fillObjectMethods,
	fillPromiseStatics,
	fillReflectToStringTag,
	fillRegExpEscape,
	fillStringMethods,
	fillWrongBuiltIns,
} from "../fills/index.ts";

fillWrongBuiltIns();
fillErrorCause();
fillArrayMethods();
fillObjectMethods();
fillStringMethods();
fillPromiseStatics();
fillRegExpEscape();
fillReflectToStringTag();
fillBigIntAsUintN();
