// `@sohedra/lynx-polyfill/streams` on the background: The streams family (`ReadableStream`,
// `WritableStream`, `TransformStream`, their readers, controllers and queuing strategies), and
// `TextEncoderStream` and `TextDecoderStream`.

import {
	fillDOMException,
	fillEncodingStreams,
	fillStreams,
	fillTextEncoding,
	globalScope,
} from "../fills/index.ts";

fillDOMException(globalScope);
fillStreams(globalScope);
fillTextEncoding(globalScope);
fillEncodingStreams(globalScope);
