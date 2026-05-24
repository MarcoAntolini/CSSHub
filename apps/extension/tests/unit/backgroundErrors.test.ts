import { describe, expect, it } from "vitest";
import { toUserSafeError } from "../../src/background/errors";

describe("toUserSafeError", () => {
	it("maps expired backend OAuth state failures", () => {
		expect(toUserSafeError(new Error("Invalid or expired OAuth state"))).toEqual({
			message: "GitHub login session expired. Please try again.",
			code: "AUTH_SESSION_EXPIRED",
		});
	});

	it("maps unauthorized extension redirect failures", () => {
		expect(toUserSafeError(new Error("Invalid redirect URI"))).toEqual({
			message:
				"This extension build is not authorized for GitHub sign-in. Contact support.",
			code: "AUTH_REDIRECT_INVALID",
		});
	});

	it("maps invalid OAuth backend request payloads", () => {
		expect(toUserSafeError(new Error("Invalid request payload"))).toEqual({
			message:
				"GitHub sign-in could not reach the OAuth backend correctly. Please update the extension and try again.",
			code: "AUTH_BACKEND_REQUEST_INVALID",
		});
	});

	it("maps backend OAuth exchange failures", () => {
		expect(toUserSafeError(new Error("OAuth exchange failed"))).toEqual({
			message:
				"GitHub did not complete sign-in. Verify the OAuth callback setup and try again.",
			code: "AUTH_OAUTH_EXCHANGE_FAILED",
		});
	});
});
