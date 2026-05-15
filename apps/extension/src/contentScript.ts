import { contentScriptTabMessageSchema } from "./shared/contracts";
import {
	didStatsChange,
	extractStatsFromDocument,
	type SubmissionStats,
} from "./contentScriptStats";

const PREVIEW_SELECTOR = "iframe[title*='Preview' i]";
const SUBMIT_LABEL = /submit/i;
const CLICKABLE_SELECTOR = "button, [role='button'], input[type='submit'], a";
const POST_SUBMIT_SETTLE_DELAY_MS = 750;
const POST_SUBMIT_WAIT_TIMEOUT_MS = 20_000;
const POST_SUBMIT_POLL_INTERVAL_MS = 300;
const EXTENSION_CONTEXT_INVALIDATED = "Extension context invalidated";

type ElementDimensions = {
	x: number;
	y: number;
	width: number;
	height: number;
};

const isExtensionContextInvalidated = (error: unknown): boolean =>
	error instanceof Error && error.message.includes(EXTENSION_CONTEXT_INVALIDATED);

const getElementPositionAndDimensions = (
	selector: string
): ElementDimensions | null => {
	const element = document.querySelector(selector);
	if (!element) {
		return null;
	}

	const rect = element.getBoundingClientRect();
	const devicePixelRatio = window.devicePixelRatio || 1;
	const dimensions = {
		x: rect.left * devicePixelRatio,
		y: rect.top * devicePixelRatio,
		width: rect.width * devicePixelRatio,
		height: rect.height * devicePixelRatio,
	};

	if (dimensions.width <= 0 || dimensions.height <= 0) {
		return null;
	}

	return dimensions;
};

const getChallengeId = (): string => {
	const match = window.location.pathname.match(/^\/play\/(\d+)/);
	return match?.[1] ?? "unknown";
};

const getChallengeName = (): string => {
	const title = document.title.trim();
	const targetMatch = title.match(/Target\s*#?\d+\s*:\s*(.+)$/i);
	if (targetMatch?.[1]) {
		return targetMatch[1].trim();
	}

	return `Target-${getChallengeId()}`;
};

const extractCodeFromVisibleDomLines = (): string => {
	const lines = Array.from(document.querySelectorAll(".cm-line")).map((line) =>
		Array.from(line.childNodes)
			.map((node) => node.textContent ?? "")
			.join("")
	);
	return lines.join("\n").trim();
};

const extractCode = async (): Promise<string> => {
	try {
		const response = (await chrome.runtime.sendMessage({
			action: "extractCssbattleEditorCode",
		})) as { ok?: boolean; data?: { code?: string | null }; error?: string };
		if (response?.ok && response.data && "code" in response.data) {
			const fromEditor = response.data.code;
			if (typeof fromEditor === "string") {
				return fromEditor.trim();
			}
		}
	} catch (_error) {
		// e.g. extension context invalidated — fall back to visible lines only
	}

	return extractCodeFromVisibleDomLines();
};

const extractStats = (): SubmissionStats => extractStatsFromDocument(document);

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => window.setTimeout(resolve, ms));

const isTargetImage = (img: HTMLImageElement): boolean => {
	const altText = (img.getAttribute("alt") ?? "").toLowerCase();
	const className = img.className.toString().toLowerCase();
	const src = img.getAttribute("src") ?? "";

	return (
		altText.includes("target") ||
		altText.includes("battle") ||
		className.includes("target") ||
		src.startsWith("/targets/")
	);
};

const getTargetImage = (): { type: "dataUrl" | "url"; value: string } | null => {
	const imgCandidates = Array.from(document.querySelectorAll("img"));
	for (const img of imgCandidates) {
		if (isTargetImage(img)) {
			return { type: "url", value: img.currentSrc || img.src };
		}
	}

	const canvasCandidate = document.querySelector("canvas");
	if (canvasCandidate instanceof HTMLCanvasElement) {
		try {
			return {
				type: "dataUrl",
				value: canvasCandidate.toDataURL("image/png"),
			};
		} catch (_error) {
			return null;
		}
	}

	return null;
};

const capturePreviewImage = async (): Promise<string | null> => {
	const message = {
		action: "captureElement",
		selector: PREVIEW_SELECTOR,
	};

	try {
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok || typeof response?.data?.croppedDataUrl !== "string") {
			return null;
		}

		return response.data.croppedDataUrl;
	} catch (error) {
		if (isExtensionContextInvalidated(error)) {
			throw error;
		}

		console.warn("[CssHub] Preview capture failed; continuing without image", error);
		return null;
	}
};

const waitForPostSubmitStats = async (initial: SubmissionStats): Promise<SubmissionStats> => {
	await sleep(POST_SUBMIT_SETTLE_DELAY_MS);

	const deadline = Date.now() + POST_SUBMIT_WAIT_TIMEOUT_MS;
	let latest = extractStats();
	while (Date.now() < deadline) {
		if (didStatsChange(latest, initial)) {
			return latest;
		}
		await sleep(POST_SUBMIT_POLL_INTERVAL_MS);
		latest = extractStats();
	}

	return latest;
};

let isProcessingSubmission = false;

const processSubmission = async (): Promise<void> => {
	if (isProcessingSubmission) {
		console.info(
			"[CssHub] Submit ignored because a previous submission is still processing."
		);
		return;
	}
	isProcessingSubmission = true;

	try {
		const initialStats = extractStats();
		const [postSubmitStats, resultImageDataUrl] = await Promise.all([
			waitForPostSubmitStats(initialStats),
			capturePreviewImage(),
		]);
		const payload = {
			challengeId: getChallengeId(),
			challengeName: getChallengeName(),
			challengeUrl: window.location.href,
			submittedAt: new Date().toISOString(),
			score: postSubmitStats.score,
			matchPct: postSubmitStats.matchPct,
			code: await extractCode(),
			targetImage: getTargetImage(),
			resultImageDataUrl,
		};

		const message = {
			action: "cssbattleSubmission",
			payload,
		};
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			console.warn(
				"[CssHub] Submission rejected by extension background logic."
			);
			return;
		}
		const ingestion = response.data as
			| { committed?: unknown; reason?: unknown }
			| undefined;
		const reason =
			typeof ingestion?.reason === "string"
				? ingestion.reason
				: "Submission processed";
		if (ingestion?.committed === true) {
			console.info("[CssHub] Submission committed", { reason });
			return;
		}
		console.info("[CssHub] Submission skipped", { reason });
	} catch (error) {
		if (isExtensionContextInvalidated(error)) {
			console.warn(
				"[CssHub] Extension was reloaded; reload this CSSBattle tab before submitting again."
			);
			return;
		}

		console.error("[CssHub] Submission processing failed unexpectedly", error);
	} finally {
		isProcessingSubmission = false;
	}
};

const installSubmitListeners = (): void => {
	// Main ingestion path: capture and submit are automatic on CSSBattle submit clicks.
	document.addEventListener(
		"click",
		(event) => {
			const target = event.target as HTMLElement | null;
			if (!target) {
				return;
			}
			const clickable = target.closest(CLICKABLE_SELECTOR);
			if (!clickable) {
				return;
			}
			const text =
				clickable instanceof HTMLInputElement
					? clickable.value
					: clickable.textContent?.trim() ?? "";
			if (!SUBMIT_LABEL.test(text)) {
				return;
			}
			void processSubmission();
		},
		true
	);
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	const parsed = contentScriptTabMessageSchema.safeParse(request);
	if (!parsed.success) {
		return;
	}

	if (parsed.data.action === "getElementPositionAndDimensions") {
		sendResponse(getElementPositionAndDimensions(parsed.data.selector));
	}
});

if (window.location.pathname.startsWith("/play/")) {
	installSubmitListeners();
	console.info("[CssHub] Auto-capture enabled: submissions are synced on submit.");
}
