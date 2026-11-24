// The app's own encoder, installed on the global object as the app starts.
class Encoder {
	encode(text: string): Uint8Array {
		return new Uint8Array(text.length);
	}
}

globalThis.TextEncoder = Encoder as never;
