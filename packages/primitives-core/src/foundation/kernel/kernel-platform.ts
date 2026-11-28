// The platform contract: everything core gets from the platform it runs on. A stable contract that
// only grows (see "Platform" in ARCHITECTURE.md); changing a member needs the owner's sign-off.

/**
 * The types a platform plugs into core. Core reaches them only through a type parameter
 * (`T["element"]`), so it never sees a platform's element or event types.
 */
export interface PlatformTypes {
	/** The platform's element handle. Core compares handles by identity and hands them back. */
	element: object;
	/**
	 * The native event per change reason: the type of a change's `event`. It must have a `none`
	 * entry: a reason the map doesn't list gets the `none` entry's event (without one, such a
	 * change's event is typed `unknown`). It includes `imperative-action`, the event of a change no
	 * native event caused.
	 */
	events: Record<string, unknown>;
	/** Change reasons the platform adds to core's `REASONS` (a platform's back key). */
	reasons: string;
}

/** The event a platform passes with a change for `Reason`. */
export type PlatformEvent<
	T extends PlatformTypes,
	Reason extends string = string,
> = Reason extends keyof T["events"] ? T["events"][Reason] : T["events"]["none"];

/** Any event of the platform, for code that only forwards it. */
export type AnyPlatformEvent<T extends PlatformTypes> = T["events"][keyof T["events"]];

/**
 * Time. Every method is synchronous and returns at once; `timeout`, `frame` and `microtask`
 * return a function that cancels the callback if it hasn't run. None of them ever runs its
 * callback before it returns, not even `timeout(callback, 0)`: core relies on it (a callback run
 * during the call would leave `Timeout.isStarted()` true after it ran).
 */
export interface Scheduler {
	/** Runs `callback` once, after at least `ms` milliseconds; never before it returns. */
	readonly timeout: (callback: () => void, ms: number) => () => void;
	/** Runs `callback` before the next frame is drawn; never before it returns. */
	readonly frame: (callback: () => void) => () => void;
	/**
	 * Runs `callback` after the current synchronous work (never before it returns), before any
	 * `timeout` scheduled after it. No guarantee relative to Svelte's flush or to promises.
	 */
	readonly microtask: (callback: () => void) => () => void;
	/** Milliseconds, on the same clock as the event timestamps the platform passes in. */
	readonly now: () => number;
}

/** Document order. */
export interface OrderService<T extends PlatformTypes> {
	/**
	 * Below 0 when `a` comes first, above 0 when `b` does, 0 when neither (the same handle, or
	 * separate trees). A disconnected handle sorts after a connected one. Synchronous: a platform
	 * without synchronous tree queries answers from an order it recorded at registration.
	 */
	readonly compare: (a: T["element"], b: T["element"]) => number;
}

/** How a focus move is made. */
export interface FocusOptions {
	/** Whether the focused element shows a focus ring. */
	readonly focusVisible?: boolean | undefined;
	/** Whether the platform keeps the scroll position. */
	readonly preventScroll?: boolean | undefined;
	/** Whether a focused text field selects its text (a field to correct). */
	readonly select?: boolean | undefined;
}

/** Moving focus, where a core decision must act synchronously. */
export interface FocusService<T extends PlatformTypes> {
	readonly focus: (target: T["element"], options?: FocusOptions) => void;
}

/**
 * The number formatting options core reads. `Intl.NumberFormatOptions` is assignable; options
 * core doesn't read pass through to the platform untouched.
 */
export interface NumberFormatOptions {
	readonly style?: string | undefined;
	readonly notation?: string | undefined;
	readonly maximumFractionDigits?: number | undefined;
	readonly minimumFractionDigits?: number | undefined;
	readonly maximumSignificantDigits?: number | undefined;
	readonly minimumSignificantDigits?: number | undefined;
	readonly roundingMode?: string | undefined;
}

/**
 * The collation options core reads. `Intl.CollatorOptions` is assignable; options core doesn't
 * read pass through to the platform untouched.
 */
export interface CollatorOptions {
	readonly usage?: string | undefined;
	readonly sensitivity?: string | undefined;
	readonly ignorePunctuation?: boolean | undefined;
}

/** A number formatter (web: `Intl.NumberFormat`). */
export interface NumberFormatter {
	readonly format: (value: number) => string;
	readonly formatToParts: (
		value: number,
	) => readonly { readonly type: string; readonly value: string }[];
}

/** A string collator (web: `Intl.Collator`). */
export interface Collator {
	readonly compare: (a: string, b: string) => number;
}

/** Locale-aware numbers and text. Core never inspects `locales`; it forwards them. */
export interface LocaleService {
	readonly numberFormat: (locales: unknown, options?: NumberFormatOptions) => NumberFormatter;
	readonly collator: (locales: unknown, options?: CollatorOptions) => Collator;
}

/** What a form control asks of the platform's form. */
export interface FormService<T extends PlatformTypes> {
	/** Submits the form that owns `control`, as a submit button would. */
	readonly requestSubmit: (control: T["element"]) => void;
}

/**
 * Everything core gets from the platform it runs on. A root part passes its platform to its
 * store's constructor; child stores get it from their parent. Every member is synchronous: the
 * platform pushes facts in with calls, and core never awaits it.
 */
export interface Platform<T extends PlatformTypes = PlatformTypes> {
	readonly scheduler: Scheduler;
	readonly order: OrderService<T>;
	readonly focus: FocusService<T>;
	readonly locale: LocaleService;
	readonly form: FormService<T>;
}

const never = (): (() => void) => noop;
function noop() {}
function noLocale(): never {
	throw new Error("Sohedra: A store with no mounted Root has no locale.");
}

/**
 * The platform of a store no platform runs yet, such as the fallback store of a handle created at module
 * scope: its timers never fire, its time stands still, document order and focus moves and form
 * submits do nothing, and asking it for a locale formatter or collator throws (a detached store
 * has no locale). Such a store never opens, so nothing asks it for more.
 */
export const inertPlatform: Platform = Object.freeze({
	scheduler: Object.freeze({ timeout: never, frame: never, microtask: never, now: () => 0 }),
	order: Object.freeze({ compare: () => 0 }),
	focus: Object.freeze({ focus: noop }),
	locale: Object.freeze({ numberFormat: noLocale, collator: noLocale }),
	form: Object.freeze({ requestSubmit: noop }),
});
