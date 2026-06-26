import {
	detectChallengeContext,
	resolveBattleMetadataFromSources,
} from "./contentScriptChallengeContext";
import {
	detectCaptureIssues,
	formatCaptureFailureReason,
	type CaptureIssueId,
} from "./contentScriptCaptureIssues";
import {
	hideCaptureFailurePrompt,
	showCaptureFailurePrompt,
} from "./contentScriptCapturePrompt";
import {
	CLICKABLE_SELECTOR,
	addCssBattleSubmitShortcutListener,
	asImageDataUrlOrNull,
	extractCodeFromCmLines,
	fetchTargetImagePayload,
	findPreviewIframe,
	getChallengeIdFromPathname,
	getChallengeNameFromTitle,
	getElementDimensions,
	getElementDimensionsFromElement,
	isSubmitControlText,
	waitForPreviewIframeReady,
} from "./contentScriptDom";
import {
	parseContentScriptTabMessage,
	sendBackgroundAction,
	sendCaptureAttemptFailedMessage,
	sendCapturePreviewMessage,
	sendCssbattleBattleMetadataMessage,
	sendCssbattleSubmissionMessage,
} from "./contentScriptMessaging";
import {
	capturePreviewFromDocument,
	capturePreviewFromDocumentAsync,
} from "./previewDocumentCapture";
import { executePreviewCaptureStrategy } from "./preview/previewCaptureStrategy";
import type { ElementDimensions, SubmissionPayload } from "./shared/contracts";
import {
	extractStatsFromDocument,
	type SubmissionStats,
	waitForPostSubmitStats,
} from "./contentScriptStats";

const EXTENSION_CONTEXT_INVALIDATED = "Extension context invalidated";
const CSSHUB_SUBMIT_SHORTCUT_MESSAGE_TYPE = "CSSHUB_SUBMIT_SHORTCUT";
const CSSHUB_MESSAGE_SOURCE = "csshub-shortcut-bridge";
const KEYBOARD_SUBMISSION_DEBOUNCE_MS = 750;

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
	| "challengeMode"
	| "battleId"
	| "battleGroup"
	| "challengeLabel"
	| "dailyDateIso"
	| "dailyDateLabel"
> | null => {
	if (context.mode === "battle") {
		return {
			challengeMode: "battle",
			battleId: context.battleId,
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

const capturePreviewFromIframeLocally = async (
	iframe: HTMLIFrameElement
): Promise<string | null> => {
	try {
		const doc = iframe.contentDocument;
		if (!doc) {
			return null;
		}
		return asImageDataUrlOrNull(
			capturePreviewFromDocument(doc) ?? (await capturePreviewFromDocumentAsync(doc))
		);
	} catch (_error) {
		return null;
	}
};

const capturePreviewImage = async (): Promise<string | null> => {
	const devicePixelRatio = window.devicePixelRatio || 1;
	return executePreviewCaptureStrategy({
		sleep,
		waitForPreviewIframe: () => waitForPreviewIframeReady(document),
		findPreviewIframe: () => findPreviewIframe(document),
		getIframeDimensions: (iframe) =>
			getElementDimensionsFromElement(iframe, devicePixelRatio),
		captureViaBackground: async (dimensions) => {
			const dataUrl = await sendCapturePreviewMessage(dimensions ?? undefined);
			return dataUrl ? asImageDataUrlOrNull(dataUrl) : null;
		},
		captureFromIframe: capturePreviewFromIframeLocally,
		isExtensionContextInvalidated,
		onBackgroundFailure: (error) => {
			console.warn("[CssHub] Tab screenshot preview capture failed", error);
		},
		onIframeFailure: (error) => {
			console.warn("[CssHub] Preview iframe capture attempt failed", error);
		},
		onExhausted: () => {
			console.warn("[CssHub] Preview capture failed after retries; continuing without image");
		},
	});
};

let isProcessingSubmission = false;
let lastKeyboardSubmissionAt = 0;

const notifySubmissionProcessingStarted = (): void => {
	void sendBackgroundAction("submissionProcessingStarted");
};

const clearSubmissionBadge = (): void => {
	void sendBackgroundAction("clearActionBadge");
};

const reportCaptureFailure = async (params: {
	issueIds: CaptureIssueId[];
	challengeId?: string;
	challengeName?: string;
	challengeUrl?: string;
	unsupportedContext?: boolean;
}): Promise<boolean> => {
	const reason = formatCaptureFailureReason(params.issueIds, {
		unsupportedContext: params.unsupportedContext,
	});
	showCaptureFailurePrompt(params.issueIds, {
		unsupportedContext: params.unsupportedContext,
	});
	return sendCaptureAttemptFailedMessage({
		issueIds: params.issueIds,
		reason,
		challengeId: params.challengeId,
		challengeName: params.challengeName,
		challengeUrl: params.challengeUrl,
	});
};

const processSubmission = async (): Promise<void> => {
	if (isProcessingSubmission) {
		console.info(
			"[CssHub] Submit ignored because a previous submission is still processing."
		);
		return;
	}
	isProcessingSubmission = true;
	let sentToBackground = false;
	let captureFailureReported = false;

	hideCaptureFailurePrompt();
	notifySubmissionProcessingStarted();

	try {
		const challengeContext = detectChallengeContext(document);
		if (challengeContext.mode === "unsupported") {
			captureFailureReported = await reportCaptureFailure({
				issueIds: ["challenge-metadata"],
				challengeUrl: window.location.href,
				unsupportedContext: true,
			});
			return;
		}

		const modeFields = buildSubmissionPayloadBase(challengeContext);
		if (!modeFields) {
			return;
		}

		const initialStats = extractStats();
		const codePromise = extractCode();
		const previewCapturePromise = capturePreviewImage();
		const [postSubmitStats, resultImageDataUrl, targetImage, code] = await Promise.all([
			waitForPostSubmitStats(document, initialStats),
			previewCapturePromise,
			fetchTargetImagePayload(document, window.location.href, getChallengeId()),
			codePromise,
		]);
		const challengeId = getChallengeId();
		const challengeName =
			challengeContext.mode === "daily"
				? challengeContext.dailyDateLabel
				: challengeContext.mode === "battle"
					? challengeContext.challengeLabel
					: getChallengeName();
		const captureIssues = detectCaptureIssues({
			challengeContext,
			challengeId,
			challengeName,
			stats: postSubmitStats,
			code,
			targetImage,
			resultImageDataUrl,
			documentRoot: document,
		});
		if (captureIssues.length > 0) {
			captureFailureReported = await reportCaptureFailure({
				issueIds: captureIssues,
				challengeId,
				challengeName,
				challengeUrl: window.location.href,
				unsupportedContext: false,
			});
			return;
		}

		const characterCount = postSubmitStats.characterCount ?? code.length;
		const battleMetadata =
			challengeContext.mode === "battle"
				? await resolveBattleMetadataFromSources(
						challengeContext,
						document,
						sendCssbattleBattleMetadataMessage
					)
				: null;
		const battleTotalChallenges = battleMetadata?.totalChallenges ?? null;
		const battleStatus = battleMetadata?.status ?? "unfinished";

		const payload: SubmissionPayload = {
			...modeFields,
			...(battleTotalChallenges
				? {
						battleTotalChallenges,
						battleStatus,
					}
				: {}),
			challengeId,
			challengeName,
			challengeUrl: window.location.href,
			submittedAt: new Date().toISOString(),
			score: postSubmitStats.score,
			matchPct: postSubmitStats.matchPct,
			characterCount,
			code,
			targetImage,
			resultImageDataUrl,
		};

		const response = await sendCssbattleSubmissionMessage(payload);
		sentToBackground = true;
		hideCaptureFailurePrompt();
		if (!response.ok) {
			console.warn(
				`[CssHub] Submission rejected by extension background logic. ${response.error}`
			);
			return;
		}
		const { reason, committed } = response.data;
		if (committed) {
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
		if (!sentToBackground && !captureFailureReported) {
			clearSubmissionBadge();
		}
		isProcessingSubmission = false;
	}
};

const processKeyboardSubmission = (): void => {
	const now = Date.now();
	if (now - lastKeyboardSubmissionAt < KEYBOARD_SUBMISSION_DEBOUNCE_MS) {
		return;
	}
	lastKeyboardSubmissionAt = now;
	void processSubmission();
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
	addCssBattleSubmitShortcutListener(window, processKeyboardSubmission);
	window.addEventListener(
		"message",
		(event) => {
			if (event.source !== window || event.origin !== window.location.origin) {
				return;
			}
			const data = event.data as { source?: unknown; type?: unknown } | null;
			if (
				data?.source !== CSSHUB_MESSAGE_SOURCE ||
				data.type !== CSSHUB_SUBMIT_SHORTCUT_MESSAGE_TYPE
			) {
				return;
			}
			processKeyboardSubmission();
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
