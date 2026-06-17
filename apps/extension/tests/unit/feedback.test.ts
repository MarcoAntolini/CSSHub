import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearActionBadge,
	resolveNotificationAction,
	setSetupActionBadgeState,
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
				setTitle: vi.fn(),
			},
		});
		clearActionBadge();
		setSetupActionBadgeState({ hasSelectedRepo: true, isAuthenticated: true });
		vi.clearAllMocks();
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
		setSetupActionBadgeState({ hasSelectedRepo: true, isAuthenticated: true });
		setLoadingBadge();
		setActionBadge("success", "OK");

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "OK" });

		vi.advanceTimersByTime(10_000);
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
	});

	it("clears the badge immediately", () => {
		setSetupActionBadgeState({ hasSelectedRepo: true, isAuthenticated: true });
		setLoadingBadge();
		clearActionBadge();

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
	});

	it("shows a persistent red sign-in badge while logged out", () => {
		setSetupActionBadgeState({ hasSelectedRepo: false, isAuthenticated: false });

		expect(chrome.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
			color: "#b91c1c",
		});
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
		expect(chrome.action.setTitle).toHaveBeenLastCalledWith({
			title: "CssHub: sign in required",
		});
	});

	it("shows a persistent yellow repo badge when signed in without a selected repo", () => {
		setSetupActionBadgeState({ hasSelectedRepo: false, isAuthenticated: true });

		expect(chrome.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
			color: "#b45309",
		});
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
		expect(chrome.action.setTitle).toHaveBeenLastCalledWith({
			title: "CssHub: select a repository",
		});
	});

	it("keeps the logged-out badge instead of showing transient feedback", () => {
		setSetupActionBadgeState({ hasSelectedRepo: false, isAuthenticated: false });
		setActionBadge("error", "ERR");

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });

		vi.advanceTimersByTime(10_000);
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
	});

	it("keeps the missing-repo badge instead of showing transient feedback", () => {
		setSetupActionBadgeState({ hasSelectedRepo: false, isAuthenticated: true });
		setActionBadge("success", "OK");

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
		vi.advanceTimersByTime(10_000);
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
	});

	it("restores the logged-out badge if setup state changes while a result is visible", () => {
		setActionBadge("success", "OK");

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "OK" });

		setSetupActionBadgeState({ hasSelectedRepo: false, isAuthenticated: false });

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
		vi.advanceTimersByTime(10_000);
		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "!" });
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
