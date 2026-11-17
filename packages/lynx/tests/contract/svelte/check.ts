/** One contract check: it throws when what the binding relies on is no longer true. */
export type Check = () => void | Promise<void>;

/** The checks of one module, by the id of the manifest row each one covers. */
export type Checks = Record<string, Check>;
