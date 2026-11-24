// `@sohedra/lynx-polyfill/language` on the background: The language through ES2025 that Lynx's
// engine lacks or gets wrong: core-js's light fills and the own fixes behind behavior checks.

import {
	fillArrayMethods,
	fillBigIntAsUintN,
	fillErrorCause,
	fillLynxPromise,
	fillObjectMethods,
	fillPromiseStatics,
	fillReflectToStringTag,
	fillRegExpEscape,
	fillStringMethods,
	fillWrongBuiltIns,
	readLynx,
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
fillLynxPromise(readLynx);
