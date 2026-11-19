// `@rstest/core` under Vitest, for the library tests that run under both: Vitest's functions under
// Rstest's names.

export { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, test } from "vitest";
export { vi as rs } from "vitest";
