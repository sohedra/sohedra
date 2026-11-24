// The types of decode-uri-component.js.

/** `text` with each `%XX` decoded as UTF-8 bytes, a bad sequence as U+FFFD. */
export function decodeURIComponent(text: string): string;
