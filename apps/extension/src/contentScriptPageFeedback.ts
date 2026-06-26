import {
	formatMissingFieldsList,
	type CaptureIssueId,
} from "./contentScriptCaptureIssues";
import {
	toneFromSyncEventCode,
	type SubmissionIngestionResponse,
} from "./shared/contracts";

export const PROMPT_ELEMENT_ID = "csshub-page-feedback";
const STYLE_ELEMENT_ID = "csshub-page-feedback-styles";

const AUTO_HIDE_MS = {
	success: 6_000,
	warn: 10_000,
} as const;

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

const ensureFeedbackStyles = (): void => {
	if (document.getElementById(STYLE_ELEMENT_ID)) {
		return;
	}

	const style = document.createElement("style");
	style.id = STYLE_ELEMENT_ID;
	style.textContent = `
@keyframes csshub-feedback-enter {
	from { opacity: 0; transform: translate3d(0, 10px, 0) scale(.98); }
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

const ensurePromptElement = (accentColor: string): HTMLDivElement => {
	ensureFeedbackStyles();
	const existing = document.getElementById(PROMPT_ELEMENT_ID);
	if (existing instanceof HTMLDivElement) {
		existing.style.setProperty("--csshub-feedback-accent", accentColor);
		return existing;
	}

	const prompt = document.createElement("div");
	prompt.id = PROMPT_ELEMENT_ID;
	prompt.setAttribute("role", "alert");
	prompt.style.setProperty("--csshub-feedback-accent", accentColor);
	prompt.style.cssText = [
		"position:fixed",
		"bottom:18px",
		"right:18px",
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
		"animation:csshub-feedback-enter .22s cubic-bezier(.16,1,.3,1)",
	].join(";");
	prompt.style.backdropFilter = "blur(18px) saturate(1.15)";
	prompt.style.borderTopColor = "rgba(255, 255, 255, 0.1)";
	document.body.appendChild(prompt);
	return prompt;
};

const createDismissButton = (): HTMLButtonElement => {
	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "×";
	dismiss.setAttribute("aria-label", "Dismiss");
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
	document.getElementById(PROMPT_ELEMENT_ID)?.remove();
};

export const showPageFeedbackPrompt = (options: ShowPageFeedbackOptions): void => {
	clearAutoHideTimer();
	const styles = TONE_STYLES[options.tone];
	const prompt = ensurePromptElement(styles.accent);
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
		].join(";");
		body.append(actionLink);
	}

	prompt.append(body);

	if (options.autoHideMs != null && options.autoHideMs > 0) {
		scheduleAutoHide(options.autoHideMs);
	}
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
