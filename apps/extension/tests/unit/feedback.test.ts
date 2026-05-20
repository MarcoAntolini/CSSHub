import { describe, expect, it } from "vitest";
import { resolveNotificationAction } from "../../src/background/feedback";

describe("resolveNotificationAction", () => {
	it("opens the commit when a commit URL is available", () => {
		expect(
			resolveNotificationAction({
				commitUrl: "https://github.com/o/r/commit/abc",
			})
		).toBe("open-commit");
	});

	it("opens settings when there is no commit URL", () => {
		expect(resolveNotificationAction({ commitUrl: null })).toBe("open-settings");
		expect(resolveNotificationAction(undefined)).toBe("open-settings");
	});
});
