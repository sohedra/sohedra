// Generated from TypeScript 6.0's lib.webworker.d.ts by `pnpm -F @sohedra/lynx-polyfill generate`: do not edit.
// What `import "@sohedra/lynx-polyfill/messaging"` installs on either thread: its globals' types.
// TypeScript's declarations are Copyright Microsoft Corporation, Apache License 2.0.

/// <reference path="./web.d.ts" />

declare global {
	var CustomEvent: {
		prototype: CustomEvent;
		new <T>(type: string, eventInitDict?: CustomEventInit<T>): CustomEvent<T>;
	};
	var DOMException: {
		prototype: DOMException;
		new (message?: string, name?: string): DOMException;
		readonly INDEX_SIZE_ERR: 1;
		readonly DOMSTRING_SIZE_ERR: 2;
		readonly HIERARCHY_REQUEST_ERR: 3;
		readonly WRONG_DOCUMENT_ERR: 4;
		readonly INVALID_CHARACTER_ERR: 5;
		readonly NO_DATA_ALLOWED_ERR: 6;
		readonly NO_MODIFICATION_ALLOWED_ERR: 7;
		readonly NOT_FOUND_ERR: 8;
		readonly NOT_SUPPORTED_ERR: 9;
		readonly INUSE_ATTRIBUTE_ERR: 10;
		readonly INVALID_STATE_ERR: 11;
		readonly SYNTAX_ERR: 12;
		readonly INVALID_MODIFICATION_ERR: 13;
		readonly NAMESPACE_ERR: 14;
		readonly INVALID_ACCESS_ERR: 15;
		readonly VALIDATION_ERR: 16;
		readonly TYPE_MISMATCH_ERR: 17;
		readonly SECURITY_ERR: 18;
		readonly NETWORK_ERR: 19;
		readonly ABORT_ERR: 20;
		readonly URL_MISMATCH_ERR: 21;
		readonly QUOTA_EXCEEDED_ERR: 22;
		readonly TIMEOUT_ERR: 23;
		readonly INVALID_NODE_TYPE_ERR: 24;
		readonly DATA_CLONE_ERR: 25;
	};
	var Event: {
		prototype: Event;
		new (type: string, eventInitDict?: EventInit): Event;
		readonly NONE: 0;
		readonly CAPTURING_PHASE: 1;
		readonly AT_TARGET: 2;
		readonly BUBBLING_PHASE: 3;
	};
	var EventTarget: {
		prototype: EventTarget;
		new (): EventTarget;
	};
	var MessageChannel: {
		prototype: MessageChannel;
		new (): MessageChannel;
	};
	var MessageEvent: {
		prototype: MessageEvent;
		new <T>(type: string, eventInitDict?: MessageEventInit<T>): MessageEvent<T>;
	};
	var MessagePort: {
		prototype: MessagePort;
		new (): MessagePort;
	};
	function structuredClone<T = any>(value: T, options?: StructuredSerializeOptions): T;
}

export {};
