import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	clearActionBadge,
	resolveNotificationAction,
	setSetupActionBadgeState,
} from "@/background/feedback";

describe("setup action badge", () => {
	beforeEach(() => {
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
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("clears the badge when setup is complete", () => {
		setSetupActionBadgeState({ hasSelectedRepo: true, isAuthenticated: true });

		expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({ text: "" });
		expect(chrome.action.setTitle).toHaveBeenLastCalledWith({ title: "CssHub" });
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

	it("restores setup badge when clearActionBadge is called", () => {
		setSetupActionBadgeState({ hasSelectedRepo: false, isAuthenticated: false });
		clearActionBadge();

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
