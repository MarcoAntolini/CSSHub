import {
	formatMissingFieldsList,
	type CaptureIssueId,
} from "./contentScriptCaptureIssues";

const PROMPT_ELEMENT_ID = "csshub-capture-warning";

const COLORS = {
	text: "#fafaf9",
	muted: "#a8a29e",
	warn: "#fbbf24",
	warnBg: "rgba(251,191,36,.12)",
	missing: "#fb923c",
	border: "#44403c",
	surface: "#1c1917",
} as const;

const RETRY_GUIDANCE = "Submit again once the page finishes updating.";
const PERSISTENCE_TIP = "Still failing? Disable extensions that modify CSSBattle.";
const UNSUPPORTED_GUIDANCE =
	"CSSBattle layout not recognized — another extension may be hiding page sections.";

const ensurePromptElement = (): HTMLDivElement => {
	const existing = document.getElementById(PROMPT_ELEMENT_ID);
	if (existing instanceof HTMLDivElement) {
		return existing;
	}

	const prompt = document.createElement("div");
	prompt.id = PROMPT_ELEMENT_ID;
	prompt.setAttribute("role", "alert");
	prompt.style.cssText = [
		"position:fixed",
		"bottom:16px",
		"right:16px",
		"max-width:min(320px,calc(100vw - 32px))",
		"z-index:2147483646",
		"padding:12px 14px",
		"border-radius:10px",
		`background:${COLORS.surface}`,
		`color:${COLORS.text}`,
		"font:13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif",
		"box-shadow:0 8px 24px rgba(0,0,0,.35)",
		`border:1px solid ${COLORS.border}`,
		"border-left:3px solid #f59e0b",
	].join(";");
	document.body.appendChild(prompt);
	return prompt;
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

export const hideCaptureFailurePrompt = (): void => {
	document.getElementById(PROMPT_ELEMENT_ID)?.remove();
};

export const showCaptureFailurePrompt = (
	issueIds: readonly CaptureIssueId[],
	options?: { unsupportedContext?: boolean }
): void => {
	const { headline, detail } = buildMissingSummary(issueIds, options);
	const prompt = ensurePromptElement();
	prompt.innerHTML = "";

	const header = document.createElement("div");
	header.style.cssText = "display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin:0 0 8px;";

	const titleRow = document.createElement("div");
	titleRow.style.cssText = "display:flex;align-items:center;gap:6px;min-width:0;";

	const badge = document.createElement("span");
	badge.textContent = "!";
	badge.setAttribute("aria-hidden", "true");
	badge.style.cssText = [
		"flex-shrink:0",
		"display:inline-flex",
		"align-items:center",
		"justify-content:center",
		"width:18px",
		"height:18px",
		"border-radius:999px",
		`background:${COLORS.warnBg}`,
		`color:${COLORS.warn}`,
		"font:700 11px/1 system-ui,sans-serif",
	].join(";");

	const title = document.createElement("span");
	title.textContent = "Capture failed";
	title.style.cssText = `font-weight:600;color:${COLORS.warn};`;

	titleRow.append(badge, title);

	const dismiss = document.createElement("button");
	dismiss.type = "button";
	dismiss.textContent = "×";
	dismiss.setAttribute("aria-label", "Dismiss");
	dismiss.style.cssText = [
		"flex-shrink:0",
		"margin:-2px -4px 0 0",
		"padding:0 4px",
		"border:none",
		"background:transparent",
		`color:${COLORS.muted}`,
		"cursor:pointer",
		"font:20px/1 system-ui,sans-serif",
	].join(";");
	dismiss.addEventListener("click", () => {
		hideCaptureFailurePrompt();
	});

	header.append(titleRow, dismiss);

	const headlineLine = document.createElement("p");
	headlineLine.textContent = headline;
	headlineLine.style.cssText = `margin:0 0 6px;font-weight:500;color:${COLORS.missing};`;

	const detailLine = document.createElement("p");
	detailLine.textContent = detail;
	detailLine.style.cssText = `margin:0 0 6px;color:${COLORS.text};`;

	const tipLine = document.createElement("p");
	tipLine.textContent = PERSISTENCE_TIP;
	tipLine.style.cssText = `margin:0;font-size:12px;color:${COLORS.muted};`;

	prompt.append(header, headlineLine, detailLine, tipLine);
};
