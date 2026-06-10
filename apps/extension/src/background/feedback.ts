import { openSettingsPage } from "@/openSettingsPage";
import { MAX_RECENT_EVENTS, pushSyncEvent } from "@/submission/recentEvents";

export const MAX_EVENTS = MAX_RECENT_EVENTS;
const BADGE_CLEAR_TIMEOUT_MS = 10_000;

export type FeedbackLevel = "success" | "warn" | "error" | "loading";

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

let badgeClearTimer: ReturnType<typeof setTimeout> | null = null;

const resolveBadgeBackgroundColor = (level: FeedbackLevel): string => {
	if (level === "success") {
		return "#15803d";
	}
	if (level === "warn") {
		return "#b45309";
	}
	if (level === "loading") {
		return "#2563eb";
	}
	return "#b91c1c";
};

export const clearActionBadge = (): void => {
	if (badgeClearTimer) {
		clearTimeout(badgeClearTimer);
		badgeClearTimer = null;
	}
	chrome.action.setBadgeText({ text: "" });
};

export const setLoadingBadge = (): void => {
	setActionBadge("loading", "...");
};

export const setActionBadge = (level: FeedbackLevel, text: string): void => {
	if (badgeClearTimer) {
		clearTimeout(badgeClearTimer);
		badgeClearTimer = null;
	}

	chrome.action.setBadgeBackgroundColor({ color: resolveBadgeBackgroundColor(level) });
	chrome.action.setBadgeText({ text });

	if (level === "loading") {
		return;
	}

	badgeClearTimer = setTimeout(() => {
		chrome.action.setBadgeText({ text: "" });
		badgeClearTimer = null;
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

export const pushEvent = pushSyncEvent;
