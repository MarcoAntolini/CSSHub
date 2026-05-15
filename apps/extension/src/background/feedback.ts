import type { SyncEvent } from "../shared/contracts";

export const MAX_EVENTS = 15;
const BADGE_CLEAR_TIMEOUT_MS = 10_000;

export type FeedbackLevel = "success" | "warn" | "error";

export const setActionBadge = (level: FeedbackLevel, text: string): void => {
	const bg =
		level === "success" ? "#15803d" : level === "warn" ? "#b45309" : "#b91c1c";
	chrome.action.setBadgeBackgroundColor({ color: bg });
	chrome.action.setBadgeText({ text });
	setTimeout(() => {
		chrome.action.setBadgeText({ text: "" });
	}, BADGE_CLEAR_TIMEOUT_MS);
};

export const showBrowserNotification = (
	enabled: boolean,
	level: FeedbackLevel,
	title: string,
	message: string
): void => {
	if (!enabled || !chrome.notifications) {
		return;
	}
	void chrome.notifications.create({
		type: "basic",
		title,
		message,
		iconUrl: "icons/icon_48.png",
		priority: level === "error" ? 2 : 1,
	});
};

export const pushEvent = (
	events: SyncEvent[],
	level: SyncEvent["level"],
	message: string,
	commitUrl: string | null = null,
	code?: string
): SyncEvent[] => {
	const next: SyncEvent = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		level,
		code,
		message,
		commitUrl,
	};
	return [next, ...events].slice(0, MAX_EVENTS);
};
