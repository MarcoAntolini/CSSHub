import { openSettingsPage } from "../openSettingsPage";
import type { SyncEvent } from "../shared/contracts";

export const MAX_EVENTS = 15;
const BADGE_CLEAR_TIMEOUT_MS = 10_000;

export type FeedbackLevel = "success" | "warn" | "error";

type NotificationAction = "open-commit" | "open-settings";

type NotificationMeta = {
	commitUrl: string | null;
};

const notificationMeta = new Map<string, NotificationMeta>();

export const resolveNotificationAction = (
	meta: NotificationMeta | undefined
): NotificationAction =>
	meta?.commitUrl ? "open-commit" : "open-settings";

export const runNotificationAction = (
	action: NotificationAction,
	meta: NotificationMeta | undefined
): void => {
	if (action === "open-commit" && meta?.commitUrl) {
		void chrome.tabs.create({ url: meta.commitUrl });
		return;
	}
	openSettingsPage();
};

const clearNotification = (notificationId: string): void => {
	notificationMeta.delete(notificationId);
	void chrome.notifications.clear(notificationId);
};

export const registerNotificationHandlers = (): void => {
	chrome.notifications.onClicked.addListener((notificationId) => {
		const meta = notificationMeta.get(notificationId);
		runNotificationAction(resolveNotificationAction(meta), meta);
		clearNotification(notificationId);
	});

	chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
		const meta = notificationMeta.get(notificationId);
		if (buttonIndex === 0) {
			runNotificationAction(resolveNotificationAction(meta), meta);
		}
		clearNotification(notificationId);
	});

	chrome.notifications.onClosed.addListener((notificationId) => {
		notificationMeta.delete(notificationId);
	});
};

export const setActionBadge = (level: FeedbackLevel, text: string): void => {
	const bg =
		level === "success" ? "#15803d" : level === "warn" ? "#b45309" : "#b91c1c";
	chrome.action.setBadgeBackgroundColor({ color: bg });
	chrome.action.setBadgeText({ text });
	setTimeout(() => {
		chrome.action.setBadgeText({ text: "" });
	}, BADGE_CLEAR_TIMEOUT_MS);
};

export type BrowserNotificationOptions = {
	commitUrl?: string | null;
};

export const showBrowserNotification = (
	enabled: boolean,
	level: FeedbackLevel,
	title: string,
	message: string,
	options?: BrowserNotificationOptions
): void => {
	if (!enabled || !chrome.notifications) {
		return;
	}

	const commitUrl = options?.commitUrl ?? null;
	const notificationId = `csshub-${crypto.randomUUID()}`;
	notificationMeta.set(notificationId, { commitUrl });

	void chrome.notifications.create(notificationId, {
		type: "basic",
		title,
		message,
		iconUrl: "icons/icon_48.png",
		priority: level === "error" ? 2 : 1,
		...(commitUrl
			? {
					buttons: [{ title: "View on GitHub" }],
				}
			: {}),
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
