import { describe, expect, it } from "vitest";
import {
	oauthExchangeRequestSchema,
	oauthExchangeResponseSchema,
	oauthStateResponseSchema,
} from "../src/oauth/schemas";

describe("oauthExchangeRequestSchema", () => {
	it("accepts a valid exchange payload", () => {
		const parsed = oauthExchangeRequestSchema.safeParse({
			code: "abc",
			state: "state-token",
			redirectUri: "https://abc.chromiumapp.org/github",
		});
		expect(parsed.success).toBe(true);
	});
});

describe("oauthExchangeResponseSchema", () => {
	it("accepts a valid token response", () => {
		const parsed = oauthExchangeResponseSchema.safeParse({
			accessToken: "gho_test",
			tokenType: "bearer",
			scope: "repo",
		});
		expect(parsed.success).toBe(true);
	});
});

describe("oauthStateResponseSchema", () => {
	it("accepts a valid state response", () => {
		const parsed = oauthStateResponseSchema.safeParse({
			state: "state-token",
			expiresInSec: 600,
			githubClientId: "Iv1.example",
		});
		expect(parsed.success).toBe(true);
	});
});
