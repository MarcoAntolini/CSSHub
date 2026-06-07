import { detectChallengeContext } from "./contentScriptChallengeContext";
import {
	CLICKABLE_SELECTOR,
	extractCodeFromCmLines,
	fetchTargetImagePayload,
	findPreviewIframe,
	getChallengeIdFromPathname,
	getChallengeNameFromTitle,
	getElementDimensions,
	getElementDimensionsFromElement,
	isSubmitControlText,
	waitForPreviewIframeReady,
	type ElementDimensions,
} from "./contentScriptDom";
import {
	capturePreviewFromDocument,
	capturePreviewFromDocumentAsync,
} from "./previewDocumentCapture";
import type { SubmissionPayload } from "./shared/contracts";
import {
	didStatsChange,
	extractStatsFromDocument,
	type SubmissionStats,
} from "./contentScriptStats";

const parseContentScriptTabMessage = (
	request: unknown
): { action: "getElementPositionAndDimensions"; selector: string } | null => {
	if (typeof request !== "object" || request === null) {
		return null;
	}
	const candidate = request as { action?: unknown; selector?: unknown };
	if (candidate.action !== "getElementPositionAndDimensions") {
		return null;
	}
	if (typeof candidate.selector !== "string" || candidate.selector.length === 0) {
		return null;
	}
	return {
		action: candidate.action,
		selector: candidate.selector,
	};
};

const POST_SUBMIT_SETTLE_DELAY_MS = 750;
const POST_SUBMIT_WAIT_TIMEOUT_MS = 20_000;
const POST_SUBMIT_POLL_INTERVAL_MS = 300;
const EXTENSION_CONTEXT_INVALIDATED = "Extension context invalidated";

const isExtensionContextInvalidated = (error: unknown): boolean =>
	error instanceof Error && error.message.includes(EXTENSION_CONTEXT_INVALIDATED);

const getElementPositionAndDimensions = (
	selector: string
): ElementDimensions | null =>
	getElementDimensions(document, selector, window.devicePixelRatio || 1);

const getChallengeId = (): string => getChallengeIdFromPathname(window.location.pathname);

const getChallengeName = (): string =>
	getChallengeNameFromTitle(document.title, getChallengeId());

const buildSubmissionPayloadBase = (
	context: ReturnType<typeof detectChallengeContext>
): Pick<
	SubmissionPayload,
	"challengeMode" | "battleGroup" | "challengeLabel" | "dailyDateIso" | "dailyDateLabel"
> | null => {
	if (context.mode === "battle") {
		return {
			challengeMode: "battle",
			battleGroup: context.battleGroup,
			challengeLabel: context.challengeLabel,
		};
	}
	if (context.mode === "daily") {
		return {
			challengeMode: "daily",
			dailyDateIso: context.dailyDateIso,
			dailyDateLabel: context.dailyDateLabel,
		};
	}
	return null;
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

	return extractCodeFromCmLines(document);
};

const extractStats = (): SubmissionStats => extractStatsFromDocument(document);

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => window.setTimeout(resolve, ms));

const PREVIEW_IFRAME_CAPTURE_MAX_ATTEMPTS = 8;
const PREVIEW_IFRAME_CAPTURE_RETRY_MS = 400;

const capturePreviewViaBackground = async (
	dimensions: ElementDimensions | null
): Promise<string | null> => {
	const message = {
		action: "capturePreview" as const,
		...(dimensions ? { dimensions } : {}),
	};

	const response = (await chrome.runtime.sendMessage(message)) as {
		ok?: boolean;
		data?: { croppedDataUrl?: string };
		error?: string;
	};
	if (!response?.ok || typeof response?.data?.croppedDataUrl !== "string") {
		if (response?.error) {
			console.warn("[CssHub] Background preview capture failed:", response.error);
		}
		return null;
	}

	return response.data.croppedDataUrl;
};

const capturePreviewFromIframeLocally = async (
	iframe: HTMLIFrameElement
): Promise<string | null> => {
	try {
		const doc = iframe.contentDocument;
		if (!doc) {
			return null;
		}
		return capturePreviewFromDocument(doc) ?? (await capturePreviewFromDocumentAsync(doc));
	} catch (_error) {
		return null;
	}
};

const capturePreviewImage = async (): Promise<string | null> => {
	await sleep(POST_SUBMIT_SETTLE_DELAY_MS);

	const devicePixelRatio = window.devicePixelRatio || 1;
	const iframe = await waitForPreviewIframeReady(document);
	const previewIframe = iframe ?? findPreviewIframe(document);
	const dimensions = previewIframe
		? getElementDimensionsFromElement(previewIframe, devicePixelRatio)
		: null;

	try {
		const fromScreenshot = await capturePreviewViaBackground(dimensions);
		if (fromScreenshot) {
			return fromScreenshot;
		}
	} catch (error) {
		if (isExtensionContextInvalidated(error)) {
			throw error;
		}
		console.warn("[CssHub] Tab screenshot preview capture failed", error);
	}

	for (let attempt = 0; attempt < PREVIEW_IFRAME_CAPTURE_MAX_ATTEMPTS; attempt++) {
		try {
			const currentIframe = previewIframe ?? findPreviewIframe(document);
			if (currentIframe) {
				const localCapture = await capturePreviewFromIframeLocally(currentIframe);
				if (localCapture) {
					return localCapture;
				}
			}
		} catch (error) {
			if (isExtensionContextInvalidated(error)) {
				throw error;
			}

			console.warn("[CssHub] Preview iframe capture attempt failed", error);
		}

		if (attempt < PREVIEW_IFRAME_CAPTURE_MAX_ATTEMPTS - 1) {
			await sleep(PREVIEW_IFRAME_CAPTURE_RETRY_MS);
		}
	}

	console.warn("[CssHub] Preview capture failed after retries; continuing without image");
	return null;
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
		const challengeContext = detectChallengeContext(document);
		if (challengeContext.mode === "unsupported") {
			console.info("[CssHub] Skipped: unsupported challenge mode", {
				crumbs: challengeContext.crumbs,
			});
			return;
		}

		const modeFields = buildSubmissionPayloadBase(challengeContext);
		if (!modeFields) {
			return;
		}

		const initialStats = extractStats();
		const previewCapturePromise = capturePreviewImage();
		const [postSubmitStats, resultImageDataUrl, targetImage] = await Promise.all([
			waitForPostSubmitStats(initialStats),
			previewCapturePromise,
			fetchTargetImagePayload(document, window.location.href, getChallengeId()),
		]);
		const challengeName =
			challengeContext.mode === "daily"
				? challengeContext.dailyDateLabel
				: challengeContext.mode === "battle"
					? challengeContext.challengeLabel
					: getChallengeName();

		const payload: SubmissionPayload = {
			...modeFields,
			challengeId: getChallengeId(),
			challengeName,
			challengeUrl: window.location.href,
			submittedAt: new Date().toISOString(),
			score: postSubmitStats.score,
			matchPct: postSubmitStats.matchPct,
			code: await extractCode(),
			targetImage,
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
			if (!isSubmitControlText(text)) {
				return;
			}
			void processSubmission();
		},
		true
	);
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	const parsed = parseContentScriptTabMessage(request);
	if (!parsed) {
		return;
	}

	if (parsed.action === "getElementPositionAndDimensions") {
		sendResponse(getElementPositionAndDimensions(parsed.selector));
	}
});

if (window.location.pathname.startsWith("/play/")) {
	installSubmitListeners();
	console.info("[CssHub] Auto-capture enabled: submissions are synced on submit.");
}
