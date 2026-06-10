import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearActionBadge,
	resolveNotificationAction,
	setActionBadge,
	setLoadingBadge,
} from "@/background/feedback";

describe("action badge feedback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal("chrome", {
			action: {
				setBadgeBackgroundColor: vi.fn(),
				setBadgeText: vi.fn(),
			},
		});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("shows a blue loading badge without auto-clearing", () => {
		setLoadingBadge();

		expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
			color: "#2563eb",
		});
		expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "..." });

		vi.advanceTimersByTime(15_000);
		expect(chrome.action.setBadgeText).toHaveBeenCalledTimes(1);
	});

	it("replaces loading with a result badge and clears only the latest timer", () => {
		setLoadingBadge();
		setActionBadge("success", "OK");

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "OK" });

		vi.advanceTimersByTime(10_000);
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
	});

	it("clears the badge immediately", () => {
		setLoadingBadge();
		clearActionBadge();

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
	});
});

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
