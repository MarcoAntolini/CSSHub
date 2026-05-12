const PREVIEW_SELECTOR = "iframe[title*='Preview' i]";
const SUBMIT_LABEL = /submit/i;
const LAST_SCORE_LABEL = /last\s*score/i;
const LAST_SCORE_LABEL_GLOBAL = /last\s*score/gi;
const NUMBER_REGEX = /\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/gi;
const MATCH_REGEX = /(\d+(?:[.,]\d+)?)\s*%\s*(?:match)?/gi;
const CLICKABLE_SELECTOR = "button, [role='button'], input[type='submit'], a";
const LEADERBOARD_STATS_BOX_SELECTOR = ".leaderboard-stats-box";
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

type SubmissionStats = {
	score: number | null;
	matchPct: number | null;
};

type RuntimeMessage =
	| { action: "getElementPositionAndDimensions"; selector: string }
	| {
			action: "cropImage";
			dataUrl: string;
			x: number;
			y: number;
			width: number;
			height: number;
		};

const isRuntimeMessage = (value: unknown): value is RuntimeMessage => {
	if (!value || typeof value !== "object" || !("action" in value)) {
		return false;
	}

	const message = value as Record<string, unknown>;
	if (
		message.action === "getElementPositionAndDimensions" &&
		typeof message.selector === "string"
	) {
		return message.selector.length > 0;
	}

	if (message.action !== "cropImage") {
		return false;
	}

	return (
		typeof message.dataUrl === "string" &&
		message.dataUrl.startsWith("data:image/") &&
		typeof message.x === "number" &&
		typeof message.y === "number" &&
		typeof message.width === "number" &&
		message.width > 0 &&
		typeof message.height === "number" &&
		message.height > 0
	);
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

const extractCode = (): string => {
	const lines = Array.from(document.querySelectorAll(".cm-line")).map((line) =>
		Array.from(line.childNodes)
			.map((node) => node.textContent ?? "")
			.join("")
	);
	return lines.join("\n").trim();
};

const toNumber = (value: string): number | null => {
	const parsed = Number(value.replace(",", "."));
	return Number.isFinite(parsed) ? parsed : null;
};

const parseScoreFromText = (text: string): SubmissionStats => {
	const normalized = text.replace(/\s+/g, " ").trim();
	const labelMatches = Array.from(normalized.matchAll(LAST_SCORE_LABEL_GLOBAL));
	const lastLabelMatch = labelMatches.at(-1);
	if (!lastLabelMatch) {
		return { score: null, matchPct: null };
	}

	const beforeLabel = normalized
		.slice(0, lastLabelMatch.index)
		.replace(/\{[^}]*\}/g, " ")
		.trim();

	if (/[-–—]\s*$/.test(beforeLabel)) {
		return { score: 0, matchPct: 0 };
	}

	const matchPctMatches = Array.from(beforeLabel.matchAll(MATCH_REGEX));
	const matchPctMatch = matchPctMatches.at(-1);
	const scoreSearchText = matchPctMatch
		? beforeLabel.slice(0, matchPctMatch.index).trim()
		: beforeLabel;
	const scoreMatches = Array.from(scoreSearchText.matchAll(NUMBER_REGEX));
	const scoreMatch = scoreMatches.at(-1);

	if (!scoreMatch) {
		return { score: null, matchPct: null };
	}

	const score = toNumber(scoreMatch[0]);
	const matchPct = matchPctMatch ? toNumber(matchPctMatch[1]) : 100;
	return {
		score,
		matchPct: score === null ? null : matchPct,
	};
};

const getLastScoreLabelElements = (): Element[] =>
	Array.from(document.querySelectorAll("body *")).filter((element) =>
		/^last\s*score$/i.test(element.textContent?.replace(/\s+/g, " ").trim() ?? "")
	);

const extractStats = (): SubmissionStats => {
	for (const labelElement of getLastScoreLabelElements()) {
		const statsBox = labelElement.closest(LEADERBOARD_STATS_BOX_SELECTOR);
		if (statsBox) {
			const text = statsBox.textContent?.replace(/\s+/g, " ").trim() ?? "";
			const parsed = parseScoreFromText(text);
			if (parsed.score !== null || parsed.matchPct !== null) {
				return parsed;
			}
		}

		let candidate = labelElement.parentElement;
		while (candidate && candidate !== document.body) {
			const text = candidate.textContent?.replace(/\s+/g, " ").trim() ?? "";
			const parsed = parseScoreFromText(text);
			if (parsed.score !== null || parsed.matchPct !== null) {
				return parsed;
			}
			candidate = candidate.parentElement;
		}
	}

	const relevantRoots = Array.from(document.querySelectorAll("section, div, article, main"))
		.map((root) => root.textContent?.replace(/\s+/g, " ").trim() ?? "")
		.filter((text) => LAST_SCORE_LABEL.test(text))
		.sort((left, right) => left.length - right.length);

	for (const text of relevantRoots) {
		const parsed = parseScoreFromText(text);
		if (parsed.score !== null || parsed.matchPct !== null) {
			return parsed;
		}
	}

	return { score: null, matchPct: null };
};

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => window.setTimeout(resolve, ms));

const didStatsChange = (current: SubmissionStats, initial: SubmissionStats): boolean => {
	const scoreChanged = current.score !== initial.score;
	const matchChanged = current.matchPct !== initial.matchPct;
	const becameAvailable =
		(initial.score === null && current.score !== null) ||
		(initial.matchPct === null && current.matchPct !== null);

	return scoreChanged || matchChanged || becameAvailable;
};

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
		const postSubmitStats = await waitForPostSubmitStats(initialStats);
		const resultImageDataUrl = await capturePreviewImage();
		const payload = {
			challengeId: getChallengeId(),
			challengeName: getChallengeName(),
			challengeUrl: window.location.href,
			submittedAt: new Date().toISOString(),
			score: postSubmitStats.score,
			matchPct: postSubmitStats.matchPct,
			code: extractCode(),
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
	if (!isRuntimeMessage(request)) {
		return;
	}
	const data = request;

	if (data.action === "getElementPositionAndDimensions") {
		sendResponse(getElementPositionAndDimensions(data.selector));
		return;
	}

	if (data.action === "cropImage") {
		const img = new Image();
		img.src = data.dataUrl;
		img.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = data.width;
			canvas.height = data.height;
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				return;
			}

			ctx.drawImage(
				img,
				data.x,
				data.y,
				data.width,
				data.height,
				0,
				0,
				data.width,
				data.height
			);

			const croppedDataUrl = canvas.toDataURL("image/png");
			console.debug("[CssHub] Cropped preview snapshot generated", {
				length: croppedDataUrl.length,
			});
		};
	}
});

if (window.location.pathname.startsWith("/play/")) {
	installSubmitListeners();
	console.info("[CssHub] Auto-capture enabled: submissions are synced on submit.");
}
