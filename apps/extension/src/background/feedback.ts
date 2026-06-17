import { openSettingsPage } from "@/openSettingsPage";
import { MAX_RECENT_EVENTS, pushSyncEvent } from "@/submission/recentEvents";

export const MAX_EVENTS = MAX_RECENT_EVENTS;
const BADGE_CLEAR_TIMEOUT_MS = 10_000;
const DEFAULT_ACTION_TITLE = "CssHub";
const SIGN_IN_ACTION_TITLE = "CssHub: sign in required";
const SELECT_REPO_ACTION_TITLE = "CssHub: select a repository";

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
let setupBadgeState = {
	isAuthenticated: true,
	hasSelectedRepo: true,
};
let hasTransientBadge = false;

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

const applyBaseActionBadge = (): void => {
	if (!setupBadgeState.isAuthenticated) {
		chrome.action.setBadgeBackgroundColor({ color: resolveBadgeBackgroundColor("error") });
		chrome.action.setBadgeText({ text: "!" });
		chrome.action.setTitle({ title: SIGN_IN_ACTION_TITLE });
		return;
	}

	if (!setupBadgeState.hasSelectedRepo) {
		chrome.action.setBadgeBackgroundColor({ color: resolveBadgeBackgroundColor("warn") });
		chrome.action.setBadgeText({ text: "!" });
		chrome.action.setTitle({ title: SELECT_REPO_ACTION_TITLE });
		return;
	}

	chrome.action.setBadgeText({ text: "" });
	chrome.action.setTitle({ title: DEFAULT_ACTION_TITLE });
};

export type SetupActionBadgeState = {
	isAuthenticated: boolean;
	hasSelectedRepo: boolean;
};

export const setSetupActionBadgeState = (state: SetupActionBadgeState): void => {
	setupBadgeState = state;
	const isSetupComplete = state.isAuthenticated && state.hasSelectedRepo;
	if (!isSetupComplete && hasTransientBadge) {
		if (badgeClearTimer) {
			clearTimeout(badgeClearTimer);
			badgeClearTimer = null;
		}
		hasTransientBadge = false;
		applyBaseActionBadge();
		return;
	}

	if (!hasTransientBadge) {
		applyBaseActionBadge();
	}
};

export const clearActionBadge = (): void => {
	if (badgeClearTimer) {
		clearTimeout(badgeClearTimer);
		badgeClearTimer = null;
	}
	hasTransientBadge = false;
	applyBaseActionBadge();
};

export const setLoadingBadge = (): void => {
	setActionBadge("loading", "...");
};

export const setActionBadge = (level: FeedbackLevel, text: string): void => {
	if (badgeClearTimer) {
		clearTimeout(badgeClearTimer);
		badgeClearTimer = null;
	}

	if (!setupBadgeState.isAuthenticated || !setupBadgeState.hasSelectedRepo) {
		hasTransientBadge = false;
		applyBaseActionBadge();
		return;
	}

	hasTransientBadge = true;
	chrome.action.setBadgeBackgroundColor({ color: resolveBadgeBackgroundColor(level) });
	chrome.action.setBadgeText({ text });

	if (level === "loading") {
		return;
	}

	badgeClearTimer = setTimeout(() => {
		hasTransientBadge = false;
		applyBaseActionBadge();
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
