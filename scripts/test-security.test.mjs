import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeRunResult } from "./test-security.mjs";

describe("normalizeRunResult", () => {
	it("coerces nullish spawn output streams to strings", () => {
		const result = normalizeRunResult({
			status: null,
			stdout: null,
			stderr: null,
		});

		assert.deepEqual(result, {
			status: 1,
			stdout: "",
			stderr: "",
		});
	});
});
