import { describe, expect, it } from "vitest";
import { toUserSafeError } from "../../src/background/errors";
import { shouldStoreAttemptedSubmission } from "../../src/background/handlers/submission";

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

	it("maps GitHub fast-forward conflicts", () => {
		expect(
			toUserSafeError(new Error('GitHub request failed (409): {"message":"Update is not a fast forward"}'))
		).toEqual({
			message:
				"Another commit landed on the sync branch before this one finished. CssHub retried automatically; submit once more if needed.",
			code: "GITHUB_CONFLICT",
		});
	});

	it("maps GitHub commit validation failures with API detail", () => {
		expect(
			toUserSafeError(
				new Error(
					'GitHub request failed (422): {"message":"GitRPC::BadObjectState"}'
				)
			)
		).toEqual({
			message: "GitHub rejected the commit: GitRPC::BadObjectState",
			code: "GITHUB_CONFLICT",
		});
	});
});

describe("submission storage decisions", () => {
	it("stores failed attempts for popup status without advancing duplicate baseline", () => {
		expect(shouldStoreAttemptedSubmission(true, false)).toBe(true);
	});

	it("stores successful non-duplicate attempts", () => {
		expect(shouldStoreAttemptedSubmission(false, true)).toBe(true);
	});

	it("keeps the previous display for duplicate submissions", () => {
		expect(shouldStoreAttemptedSubmission(false, false)).toBe(false);
	});
});
