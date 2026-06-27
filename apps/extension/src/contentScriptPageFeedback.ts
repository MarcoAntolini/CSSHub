import {
	formatMissingFieldsList,
	type CaptureIssueId,
} from "./contentScriptCaptureIssues";
import type { SubmissionIngestionResponse } from "./shared/contracts";
import { STORAGE_KEY } from "./storage/authSession";

export const PROMPT_ELEMENT_ID = "csshub-page-feedback";
const STYLE_ELEMENT_ID = "csshub-page-feedback-styles";

export const EDGE_INSET_PX = 18;
export const CSSBATTLE_TOAST_GAP_PX = 12;
export const CSSBATTLE_TOASTIFY_SELECTOR = ".Toastify";
export const CSSBATTLE_TOAST_SELECTOR = ".Toastify__toast";
export const FEEDBACK_ENTER_MS = 220;
export const FEEDBACK_EXIT_MS = 180;
export const FEEDBACK_UPDATE_MS = 160;
export const FEEDBACK_SLIDE_MS = 280;
const CSSBATTLE_TOAST_SETTLE_MS = 900;

const AUTO_HIDE_MS = {
	success: 6_000,
	warn: 10_000,
} as const;

const PAGE_FEEDBACK_PLACEMENTS = [
	"top-left",
	"top-right",
	"bottom-left",
	"bottom-right",
] as const;

type PageFeedbackPlacement = (typeof PAGE_FEEDBACK_PLACEMENTS)[number];

const COLORS = {
	text: "#fafaf9",
	muted: "#d6d3d1",
	subtle: "#a8a29e",
	border: "rgba(255,255,255,.10)",
	surface: "rgba(28,25,23,.94)",
	surfaceStrong: "rgba(41,37,36,.98)",
} as const;

const TONE_STYLES = {
	processing: {
		accent: "#2563eb",
		title: "#60a5fa",
		badgeBg: "rgba(96,165,250,.16)",
		headline: "#93c5fd",
		icon: "",
	},
	success: {
		accent: "#16a34a",
		title: "#4ade80",
		badgeBg: "rgba(74,222,128,.16)",
		headline: "#86efac",
		icon: "✓",
	},
	warn: {
		accent: "#f59e0b",
		title: "#fbbf24",
		badgeBg: "rgba(251,191,36,.16)",
		headline: "#fb923c",
		icon: "!",
	},
	error: {
		accent: "#dc2626",
		title: "#f87171",
		badgeBg: "rgba(248,113,113,.16)",
		headline: "#fca5a5",
		icon: "×",
	},
} as const;

const RETRY_GUIDANCE = "Submit again once the page finishes updating.";
const PERSISTENCE_TIP = "Still failing? Disable extensions that modify CSSBattle.";
const UNSUPPORTED_GUIDANCE =
	"CSSBattle layout not recognized - another extension may be hiding page sections.";

export type PageFeedbackTone = keyof typeof TONE_STYLES;

type PageFeedbackAction = {
	label: string;
	href: string;
};

export type ShowPageFeedbackOptions = {
	tone: PageFeedbackTone;
	title: string;
	headline?: string;
	detail?: string;
	tip?: string;
	action?: PageFeedbackAction;
	autoHideMs?: number | null;
	dismissible?: boolean;
};

let autoHideTimer: number | null = null;
let currentPlacement: PageFeedbackPlacement = "bottom-right";
let settingsInitialized = false;
let cssBattleAvoidanceObserver: MutationObserver | null = null;
let cssBattleAvoidanceRootObserver: MutationObserver | null = null;
let observedCssBattleToastContainer: HTMLElement | null = null;
let cssBattleAvoidanceResizeListener: (() => void) | null = null;
let cssBattleAvoidanceRefreshFrame: number | null = null;
let cssBattleAvoidanceRefreshTimer: number | null = null;
let hideAnimationToken = 0;

const isPageFeedbackPlacement = (value: unknown): value is PageFeedbackPlacement =>
	typeof value === "string" &&
	PAGE_FEEDBACK_PLACEMENTS.includes(value as PageFeedbackPlacement);

const pageFeedbackPlacementFromSettings = (settings: unknown): PageFeedbackPlacement => {
	if (!settings || typeof settings !== "object") {
		return "bottom-right";
	}
	const placement = (settings as { pageFeedbackPlacement?: unknown }).pageFeedbackPlacement;
	return isPageFeedbackPlacement(placement) ? placement : "bottom-right";
};

const toneFromSyncEventCode = (code?: string): PageFeedbackTone => {
	if (code === "SYNC_COMMITTED") {
		return "success";
	}
	if (
		code === "SYNC_SKIPPED_NOT_IMPROVED" ||
		code === "SYNC_SKIPPED_THRESHOLD" ||
		code === "SYNC_SKIPPED_INVALID_SCORE" ||
		code === "SYNC_SKIPPED_DUPLICATE" ||
		code === "SYNC_SKIPPED_PREVIEW_UNAVAILABLE"
	) {
		return "warn";
	}
	if (code) {
		return "error";
	}
	return "warn";
};

const prefersReducedMotion = (): boolean => {
	if (typeof window.matchMedia !== "function") {
		return false;
	}
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const isTopPlacement = (placement: PageFeedbackPlacement): boolean =>
	placement === "top-left" || placement === "top-right";

const getEnterAnimationName = (placement: PageFeedbackPlacement = currentPlacement): string =>
	isTopPlacement(placement) ? "csshub-feedback-enter-from-top" : "csshub-feedback-enter-from-bottom";

const getExitAnimationName = (placement: PageFeedbackPlacement = currentPlacement): string =>
	isTopPlacement(placement) ? "csshub-feedback-exit-to-top" : "csshub-feedback-exit-to-bottom";

const resetPromptAnimationState = (prompt: HTMLDivElement): void => {
	prompt.style.animation = "";
	prompt.style.opacity = "";
	prompt.style.transform = "";
	delete prompt.dataset.csshubFeedbackPhase;
};

const runPromptAnimation = (
	prompt: HTMLDivElement,
	animationName: string,
	durationMs: number,
	phase: "enter" | "exit" | "update"
): void => {
	if (prefersReducedMotion()) {
		return;
	}

	prompt.dataset.csshubFeedbackPhase = phase;
	prompt.style.animation = "none";
	void prompt.offsetHeight;
	prompt.style.animation = `${animationName} ${durationMs}ms cubic-bezier(.16,1,.3,1) forwards`;
};

const playEnterAnimation = (prompt: HTMLDivElement): void => {
	runPromptAnimation(prompt, getEnterAnimationName(), FEEDBACK_ENTER_MS, "enter");
};

const playUpdateAnimation = (prompt: HTMLDivElement): void => {
	runPromptAnimation(prompt, "csshub-feedback-update", FEEDBACK_UPDATE_MS, "update");
};

const playExitAnimation = (prompt: HTMLDivElement): Promise<void> => {
	if (prefersReducedMotion()) {
		return Promise.resolve();
	}

	runPromptAnimation(prompt, getExitAnimationName(), FEEDBACK_EXIT_MS, "exit");

	return new Promise((resolve) => {
		const finish = (): void => {
			prompt.removeEventListener("animationend", onAnimationEnd);
			resolve();
		};
		const onAnimationEnd = (event: AnimationEvent): void => {
			if (event.target !== prompt) {
				return;
			}
			finish();
		};

		prompt.addEventListener("animationend", onAnimationEnd);
		window.setTimeout(finish, FEEDBACK_EXIT_MS + 40);
	});
};

const isVisibleElement = (element: HTMLElement): boolean => {
	const style = window.getComputedStyle(element);
	if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
		return false;
	}
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
};

export const findVisibleCssBattleToast = (): HTMLElement | null => {
	const container = document.querySelector(CSSBATTLE_TOASTIFY_SELECTOR);
	if (!(container instanceof HTMLElement)) {
		return null;
	}

	const toastCandidates = Array.from(
		container.querySelectorAll<HTMLElement>(CSSBATTLE_TOAST_SELECTOR)
	);
	const nodes =
		toastCandidates.length > 0
			? toastCandidates
			: Array.from(container.children).filter(
					(child): child is HTMLElement => child instanceof HTMLElement
				);

	let topmostToast: HTMLElement | null = null;
	let topmostTop = Number.POSITIVE_INFINITY;

	for (const node of nodes) {
		if (!isVisibleElement(node)) {
			continue;
		}
		const rect = node.getBoundingClientRect();
		if (rect.width < 40 || rect.height < 20) {
			continue;
		}
		if (rect.top < topmostTop) {
			topmostTop = rect.top;
			topmostToast = node;
		}
	}

	return topmostToast;
};

export const computeEffectiveBottomOffset = (
	placement: PageFeedbackPlacement = currentPlacement
): number => {
	if (placement !== "bottom-right") {
		return EDGE_INSET_PX;
	}

	const toast = findVisibleCssBattleToast();
	if (!toast) {
		return EDGE_INSET_PX;
	}

	const rect = toast.getBoundingClientRect();
	const offset = Math.ceil(window.innerHeight - rect.top + CSSBATTLE_TOAST_GAP_PX);
	return Math.max(EDGE_INSET_PX, offset);
};

const refreshBottomRightAvoidance = (): void => {
	if (currentPlacement !== "bottom-right") {
		return;
	}

	const prompt = document.getElementById(PROMPT_ELEMENT_ID);
	if (!(prompt instanceof HTMLDivElement)) {
		return;
	}

	const nextBottom = `${computeEffectiveBottomOffset()}px`;
	if (prompt.style.bottom !== nextBottom) {
		prompt.style.bottom = nextBottom;
	}
};

const clearScheduledBottomRightAvoidanceRefresh = (): void => {
	if (cssBattleAvoidanceRefreshFrame !== null) {
		if (typeof window.cancelAnimationFrame === "function") {
			window.cancelAnimationFrame(cssBattleAvoidanceRefreshFrame);
		} else {
			window.clearTimeout(cssBattleAvoidanceRefreshFrame);
		}
		cssBattleAvoidanceRefreshFrame = null;
	}
	if (cssBattleAvoidanceRefreshTimer !== null) {
		window.clearTimeout(cssBattleAvoidanceRefreshTimer);
		cssBattleAvoidanceRefreshTimer = null;
	}
};

const scheduleBottomRightAvoidanceRefresh = (): void => {
	refreshBottomRightAvoidance();
	clearScheduledBottomRightAvoidanceRefresh();

	const requestFrame =
		typeof window.requestAnimationFrame === "function"
			? window.requestAnimationFrame.bind(window)
			: (callback: FrameRequestCallback): number =>
					window.setTimeout(() => callback(performance.now()), 0);

	cssBattleAvoidanceRefreshFrame = requestFrame(() => {
		cssBattleAvoidanceRefreshFrame = null;
		refreshBottomRightAvoidance();
	});

	cssBattleAvoidanceRefreshTimer = window.setTimeout(() => {
		cssBattleAvoidanceRefreshTimer = null;
		refreshBottomRightAvoidance();
	}, CSSBATTLE_TOAST_SETTLE_MS);
};

const stopCssBattleAvoidanceObserver = (): void => {
	cssBattleAvoidanceObserver?.disconnect();
	cssBattleAvoidanceObserver = null;
	cssBattleAvoidanceRootObserver?.disconnect();
	cssBattleAvoidanceRootObserver = null;
	observedCssBattleToastContainer = null;
	clearScheduledBottomRightAvoidanceRefresh();

	if (cssBattleAvoidanceResizeListener) {
		window.removeEventListener("resize", cssBattleAvoidanceResizeListener);
		cssBattleAvoidanceResizeListener = null;
	}
};

const startCssBattleAvoidanceObserver = (): void => {
	stopCssBattleAvoidanceObserver();

	if (currentPlacement !== "bottom-right") {
		return;
	}

	const observeContainer = (container: HTMLElement): void => {
		cssBattleAvoidanceObserver?.disconnect();
		observedCssBattleToastContainer = container;
		cssBattleAvoidanceObserver = new MutationObserver(() => {
			scheduleBottomRightAvoidanceRefresh();
		});
		cssBattleAvoidanceObserver.observe(container, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["style", "class"],
		});
		scheduleBottomRightAvoidanceRefresh();
	};

	cssBattleAvoidanceRootObserver = new MutationObserver(() => {
		const container = document.querySelector(CSSBATTLE_TOASTIFY_SELECTOR);
		if (container instanceof HTMLElement) {
			if (!cssBattleAvoidanceObserver || observedCssBattleToastContainer !== container) {
				observeContainer(container);
			}
		} else {
			cssBattleAvoidanceObserver?.disconnect();
			cssBattleAvoidanceObserver = null;
			observedCssBattleToastContainer = null;
		}
		scheduleBottomRightAvoidanceRefresh();
	});
	cssBattleAvoidanceRootObserver.observe(document.body, {
		childList: true,
		subtree: true,
	});

	const existingContainer = document.querySelector(CSSBATTLE_TOASTIFY_SELECTOR);
	if (existingContainer instanceof HTMLElement) {
		observeContainer(existingContainer);
	} else {
		cssBattleAvoidanceObserver = new MutationObserver(() => {
			const container = document.querySelector(CSSBATTLE_TOASTIFY_SELECTOR);
			if (container instanceof HTMLElement) {
				observeContainer(container);
			}
		});
		cssBattleAvoidanceObserver.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	cssBattleAvoidanceResizeListener = () => {
		scheduleBottomRightAvoidanceRefresh();
	};
	window.addEventListener("resize", cssBattleAvoidanceResizeListener, { passive: true });
	scheduleBottomRightAvoidanceRefresh();
};

export const setPageFeedbackPlacement = (placement: PageFeedbackPlacement): void => {
	if (currentPlacement === placement) {
		if (placement === "bottom-right") {
			startCssBattleAvoidanceObserver();
		}
		refreshBottomRightAvoidance();
		return;
	}

	currentPlacement = placement;

	if (placement === "bottom-right") {
		startCssBattleAvoidanceObserver();
	} else {
		stopCssBattleAvoidanceObserver();
	}

	const prompt = document.getElementById(PROMPT_ELEMENT_ID);
	if (prompt instanceof HTMLDivElement) {
		applyPromptPlacement(prompt);
	}
};

export const applyPromptPlacement = (prompt: HTMLDivElement): void => {
	prompt.dataset.placement = currentPlacement;
	prompt.style.transition = prefersReducedMotion()
		? "none"
		: `bottom ${FEEDBACK_SLIDE_MS}ms cubic-bezier(.16,1,.3,1), top ${FEEDBACK_SLIDE_MS}ms cubic-bezier(.16,1,.3,1), left ${FEEDBACK_SLIDE_MS}ms cubic-bezier(.16,1,.3,1), right ${FEEDBACK_SLIDE_MS}ms cubic-bezier(.16,1,.3,1)`;
	prompt.style.top = "auto";
	prompt.style.right = "auto";
	prompt.style.bottom = "auto";
	prompt.style.left = "auto";

	switch (currentPlacement) {
		case "top-left":
			prompt.style.top = `${EDGE_INSET_PX}px`;
			prompt.style.left = `${EDGE_INSET_PX}px`;
			break;
		case "top-right":
			prompt.style.top = `${EDGE_INSET_PX}px`;
			prompt.style.right = `${EDGE_INSET_PX}px`;
			break;
		case "bottom-left":
			prompt.style.bottom = `${EDGE_INSET_PX}px`;
			prompt.style.left = `${EDGE_INSET_PX}px`;
			break;
		case "bottom-right":
			prompt.style.right = `${EDGE_INSET_PX}px`;
			prompt.style.bottom = `${computeEffectiveBottomOffset()}px`;
			break;
	}
};

const loadPageFeedbackPlacementFromStorage = async (): Promise<void> => {
	try {
		const payload = await chrome.storage.local.get(STORAGE_KEY);
		const state = payload[STORAGE_KEY] as { settings?: unknown } | undefined;
		setPageFeedbackPlacement(pageFeedbackPlacementFromSettings(state?.settings));
	} catch {
		setPageFeedbackPlacement("bottom-right");
	}
};

export const initPageFeedbackSettings = (): void => {
	if (settingsInitialized) {
		return;
	}
	settingsInitialized = true;

	void loadPageFeedbackPlacementFromStorage();

	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local" || !changes[STORAGE_KEY]) {
			return;
		}

		const nextState = changes[STORAGE_KEY].newValue as { settings?: unknown } | undefined;
		if (!nextState?.settings) {
			return;
		}

		setPageFeedbackPlacement(pageFeedbackPlacementFromSettings(nextState.settings));
	});
};

const ensureFeedbackStyles = (): void => {
	if (document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}

	const style = document.createElement("style");
	style.id = STYLE_ELEMENT_ID;
	style.textContent = `
#${PROMPT_ELEMENT_ID} {
	will-change: bottom, top, opacity, transform;
}
#${PROMPT_ELEMENT_ID} [data-csshub-feedback-control="dismiss"]:hover {
	background: rgba(255,255,255,.12) !important;
	border-color: rgba(255,255,255,.18) !important;
	color: ${COLORS.text} !important;
	transform: translate3d(0,-1px,0);
}
#${PROMPT_ELEMENT_ID} [data-csshub-feedback-control="action"]:hover {
	background: color-mix(in srgb, var(--csshub-feedback-accent) 88%, white) !important;
	box-shadow: 0 12px 28px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.16) !important;
	transform: translate3d(0,-1px,0);
}
@keyframes csshub-feedback-enter-from-bottom {
	from { opacity: 0; transform: translate3d(0, 12px, 0) scale(.98); }
	to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes csshub-feedback-exit-to-bottom {
	from { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
	to { opacity: 0; transform: translate3d(0, 12px, 0) scale(.98); }
}
@keyframes csshub-feedback-enter-from-top {
	from { opacity: 0; transform: translate3d(0, -12px, 0) scale(.98); }
	to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes csshub-feedback-exit-to-top {
	from { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
	to { opacity: 0; transform: translate3d(0, -12px, 0) scale(.98); }
}
@keyframes csshub-feedback-update {
	from { opacity: .78; transform: translate3d(0, 4px, 0) scale(.99); }
	to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes csshub-pulse {
	0%, 100% { opacity: .72; transform: scale(.92); }
	50% { opacity: 1; transform: scale(1); }
}
@keyframes csshub-spinner {
	to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion:reduce) {
	#${PROMPT_ELEMENT_ID},
	#${PROMPT_ELEMENT_ID} * {
		animation: none !important;
		transition: none !important;
	}
}
`.trim();
	document.head.append(style);
};

const clearAutoHideTimer = (): void => {
	if (autoHideTimer !== null) {
		window.clearTimeout(autoHideTimer);
		autoHideTimer = null;
	}
};

const scheduleAutoHide = (ms: number): void => {
	clearAutoHideTimer();
	autoHideTimer = window.setTimeout(() => {
		autoHideTimer = null;
		hidePageFeedbackPrompt();
	}, ms);
};

const ensurePromptElement = (accentColor: string): { prompt: HTMLDivElement; isNew: boolean } => {
	ensureFeedbackStyles();
	const existing = document.getElementById(PROMPT_ELEMENT_ID);
	if (existing instanceof HTMLDivElement) {
		existing.style.setProperty("--csshub-feedback-accent", accentColor);
		resetPromptAnimationState(existing);
		applyPromptPlacement(existing);
		return { prompt: existing, isNew: false };
	}

	const prompt = document.createElement("div");
	prompt.id = PROMPT_ELEMENT_ID;
	prompt.setAttribute("role", "alert");
	prompt.style.cssText = [
		"position:fixed",
		"width:min(360px,calc(100vw - 36px))",
		"z-index:2147483646",
		"overflow:hidden",
		"padding:0",
		"border-radius:16px",
		`background:${COLORS.surface}`,
		`color:${COLORS.text}`,
		"font:13px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
		"letter-spacing:-.01em",
		"box-shadow:0 24px 80px rgba(0,0,0,.46),inset 0 1px 0 rgba(255,255,255,.08)",
		`border:1px solid ${COLORS.border}`,
		"border-top:1px solid rgba(255,255,255,.10)",
		"backdrop-filter:blur(18px) saturate(1.15)",
		"-webkit-backdrop-filter:blur(18px) saturate(1.15)",
	].join(";");
	prompt.style.setProperty("--csshub-feedback-accent", accentColor);
	prompt.style.backdropFilter = "blur(18px) saturate(1.15)";
	prompt.style.borderTopColor = "rgba(255, 255, 255, 0.1)";
	document.body.appendChild(prompt);
	applyPromptPlacement(prompt);
	return { prompt, isNew: true };
};

const createDismissButton = (): HTMLButtonElement => {
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "×";
	dismiss.setAttribute("aria-label", "Dismiss");
	dismiss.dataset.csshubFeedbackControl = "dismiss";
	dismiss.style.cssText = [
		"flex-shrink:0",
		"width:28px",
		"height:28px",
		"border-radius:999px",
		`border:1px solid ${COLORS.border}`,
		"background:rgba(255,255,255,.04)",
		`color:${COLORS.subtle}`,
		"cursor:pointer",
		"font:18px/1 system-ui,sans-serif",
		"transition:background .16s ease,color .16s ease,transform .16s ease",
	].join(";");
	dismiss.addEventListener("pointerdown", () => {
		dismiss.style.transform = "scale(.96)";
	});
	dismiss.addEventListener("pointerup", () => {
		dismiss.style.transform = "";
	});
	dismiss.addEventListener("click", () => {
		hidePageFeedbackPrompt();
	});
	return dismiss;
};

export const hidePageFeedbackPrompt = (): void => {
	clearAutoHideTimer();
	const prompt = document.getElementById(PROMPT_ELEMENT_ID);
	if (!(prompt instanceof HTMLDivElement)) {
		return;
	}

	const token = ++hideAnimationToken;
	void playExitAnimation(prompt).then(() => {
		if (token !== hideAnimationToken) {
			return;
		}
		prompt.remove();
	});
};

export const showPageFeedbackPrompt = (options: ShowPageFeedbackOptions): void => {
	clearAutoHideTimer();
	hideAnimationToken += 1;
	const styles = TONE_STYLES[options.tone];
	const { prompt, isNew } = ensurePromptElement(styles.accent);
	prompt.dataset.tone = options.tone;
	prompt.innerHTML = "";

	const accent = document.createElement("div");
	accent.dataset.csshubFeedbackAccent = "true";
	accent.style.cssText = [
		"height:3px",
		"width:100%",
		`background:linear-gradient(90deg,${styles.accent},rgba(255,255,255,.24))`,
	].join(";");
	prompt.append(accent);

	const body = document.createElement("div");
	body.dataset.csshubFeedbackBody = "true";
	body.style.cssText = "padding:14px 14px 13px;";

	const header = document.createElement("div");
	header.style.cssText =
		"display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 10px;";

	const titleRow = document.createElement("div");
	titleRow.style.cssText = "display:flex;align-items:center;gap:8px;min-width:0;padding-top:1px;";

	const badge = document.createElement("span");
	badge.setAttribute("aria-hidden", "true");
	badge.style.cssText = [
		"flex-shrink:0",
		"display:inline-flex",
		"align-items:center",
		"justify-content:center",
		"width:22px",
		"height:22px",
		"border-radius:999px",
		`background:${styles.badgeBg}`,
		`color:${styles.title}`,
		options.tone === "processing" ? "animation:csshub-pulse 1.2s ease-in-out infinite" : "",
		"box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)",
		"font:700 12px/1 system-ui,sans-serif",
	].join(";");
	if (options.tone === "processing") {
		const spinner = document.createElement("span");
		spinner.dataset.csshubFeedbackSpinner = "true";
		spinner.style.cssText = [
			"display:block",
			"width:12px",
			"height:12px",
			"border-radius:999px",
			"border:2px solid rgba(96,165,250,.32)",
			`border-top-color:${styles.title}`,
			"animation:csshub-spinner .72s linear infinite",
		].join(";");
		badge.append(spinner);
	} else {
		badge.textContent = styles.icon;
	}

	const title = document.createElement("span");
	title.textContent = options.title;
	title.style.cssText = [
		`color:${styles.title}`,
		"font-weight:700",
		"font-size:13px",
		"line-height:1.2",
	].join(";");

	titleRow.append(badge, title);

	header.append(titleRow);
	if (options.dismissible !== false) {
		header.append(createDismissButton());
	}

	body.append(header);

	if (options.headline) {
		const headlineLine = document.createElement("p");
		headlineLine.textContent = options.headline;
		headlineLine.style.cssText = [
			"margin:0 0 6px",
			"font-size:14px",
			"line-height:1.35",
			"font-weight:650",
			`color:${styles.headline}`,
		].join(";");
		body.append(headlineLine);
	}

	if (options.detail) {
		const detailLine = document.createElement("p");
		detailLine.textContent = options.detail;
		detailLine.style.cssText = [
			"margin:0 0 7px",
			"font-size:13px",
			"line-height:1.45",
			`color:${COLORS.text}`,
		].join(";");
		body.append(detailLine);
	}

	if (options.tip) {
		const tipLine = document.createElement("p");
		tipLine.textContent = options.tip;
		tipLine.style.cssText = [
			"margin:8px 0 0",
			"padding-top:8px",
			`border-top:1px solid ${COLORS.border}`,
			"font-size:12px",
			"line-height:1.4",
			`color:${COLORS.muted}`,
		].join(";");
		body.append(tipLine);
	}

	if (options.action) {
		const actionLink = document.createElement("a");
		actionLink.href = options.action.href;
		actionLink.textContent = options.action.label;
		actionLink.target = "_blank";
		actionLink.rel = "noreferrer";
		actionLink.style.cssText = [
			"display:inline-flex",
			"align-items:center",
			"justify-content:center",
			"margin-top:10px",
			"min-height:32px",
			"padding:0 12px",
			"border-radius:999px",
			`background:${styles.accent}`,
			"color:#ffffff",
			"font-weight:700",
			"font-size:12px",
			"text-decoration:none",
			"box-shadow:0 10px 24px rgba(0,0,0,.24)",
			"transition:background .16s ease,box-shadow .16s ease,transform .16s ease",
		].join(";");
		actionLink.dataset.csshubFeedbackControl = "action";
		body.append(actionLink);
	}

	prompt.append(body);
	applyPromptPlacement(prompt);

	if (isNew) {
		playEnterAnimation(prompt);
	} else {
		playUpdateAnimation(prompt);
	}

	if (options.autoHideMs != null && options.autoHideMs > 0) {
		scheduleAutoHide(options.autoHideMs);
	}
};

export const resetPageFeedbackStateForTests = (): void => {
	hideAnimationToken += 1;
	stopCssBattleAvoidanceObserver();
	currentPlacement = "bottom-right";
	settingsInitialized = false;
	clearAutoHideTimer();
	document.getElementById(PROMPT_ELEMENT_ID)?.remove();
};

export const showProcessingPrompt = (): void => {
	showPageFeedbackPrompt({
		tone: "processing",
		title: "Processing submission",
		detail: "Capturing result and syncing to GitHub",
		autoHideMs: null,
		dismissible: false,
	});
};

const buildMissingSummary = (
	issueIds: readonly CaptureIssueId[],
	options?: { unsupportedContext?: boolean }
): { headline: string; detail: string } => {
	if (options?.unsupportedContext && issueIds.includes("challenge-metadata")) {
		return { headline: "Page layout issue", detail: UNSUPPORTED_GUIDANCE };
	}

	const fields = formatMissingFieldsList(issueIds);
	return {
		headline: `Missing ${fields}`,
		detail: RETRY_GUIDANCE,
	};
};

export const showCaptureFailurePrompt = (
	issueIds: readonly CaptureIssueId[],
	options?: { unsupportedContext?: boolean }
): void => {
	const { headline, detail } = buildMissingSummary(issueIds, options);
	showPageFeedbackPrompt({
		tone: "warn",
		title: "Capture failed",
		headline,
		detail,
		tip: PERSISTENCE_TIP,
		autoHideMs: null,
		dismissible: true,
	});
};

const resolveSkippedTitle = (code?: string): string => {
	if (code === "SYNC_SKIPPED_NOT_IMPROVED") {
		return "Best result kept";
	}
	if (code === "SYNC_SKIPPED_DUPLICATE") {
		return "Duplicate skipped";
	}
	if (code === "SYNC_AUTH_REQUIRED" || code === "SYNC_REPO_REQUIRED") {
		return "Action needed";
	}
	return "Submission skipped";
};

export const showSubmissionErrorPrompt = (message: string): void => {
	showPageFeedbackPrompt({
		tone: "error",
		title: "Sync failed",
		detail: message,
		autoHideMs: null,
		dismissible: true,
	});
};

export const showSubmissionOutcomePrompt = (data: SubmissionIngestionResponse): void => {
	if (data.committed) {
		showPageFeedbackPrompt({
			tone: "success",
			title: "Synced to GitHub",
			detail: data.reason,
			action: data.commitUrl
				? { label: "View commit on GitHub", href: data.commitUrl }
				: undefined,
			autoHideMs: AUTO_HIDE_MS.success,
			dismissible: true,
		});
		return;
	}

	const tone = toneFromSyncEventCode(data.code);
	if (tone === "error") {
		showSubmissionErrorPrompt(data.reason);
		return;
	}

	showPageFeedbackPrompt({
		tone: "warn",
		title: resolveSkippedTitle(data.code),
		detail: data.reason,
		autoHideMs: AUTO_HIDE_MS.warn,
		dismissible: true,
	});
};
