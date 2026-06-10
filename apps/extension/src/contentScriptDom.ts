/** Pure DOM helpers for the CSSBattle content script (testable without extension APIs). */

import {
	capturePreviewFromDocument,
	capturePreviewFromDocumentAsync,
} from "./previewDocumentCapture";

export const PREVIEW_SELECTOR = "iframe[title*='Preview' i]";
export const PREVIEW_IFRAME_SELECTORS = [
	"iframe.preview-iframe",
	'iframe[class*="preview-iframe" i]',
	'iframe[title="Preview"]',
	PREVIEW_SELECTOR,
	'iframe[sandbox*="allow-same-origin" i][title*="preview" i]',
] as const;

export const TARGET_ASSET_PATH_REGEX = /\/targets\/[^/?#]+\.(?:png|jpe?g|webp|gif)/i;

export const isCssBattleHostedTargetUrl = (url: string): boolean =>
	TARGET_ASSET_PATH_REGEX.test(url) ||
	(url.includes("firebasestorage.googleapis.com") &&
		(url.includes("/targets/") || url.includes("%2Ftargets%2F")));
export const TARGET_ASSET_ID_REGEX =
	/\/targets\/([^/?#]+?)(?:@\d+x)?\.(?:png|jpe?g|webp|gif)/i;

export const LEVEL_PAGE_TARGET_SELECTORS = [
	"img.levelpage__target",
	'img[class*="levelpage__target" i]',
] as const;

export const TARGET_PANE_IMAGE_SELECTORS = [
	'[class*="container__item--target"] img',
	'[class*="item--target"] img',
] as const;

export const FOOTER_DECORATIVE_IMAGE_SELECTOR =
	".footer__deco, .v2-footer, footer";

export const DAILY_TARGET_IMAGEKIT_BASE =
	"https://ik.imagekit.io/cssbattle/og/target";

export const isNumericChallengeId = (challengeId: string): boolean =>
	/^\d+$/.test(challengeId);

export const SUBMIT_LABEL = /submit/i;
export const CLICKABLE_SELECTOR =
	"button, [role='button'], input[type='submit'], a";
export const CM_LINE_SELECTOR = ".cm-line";
export const MONACO_LINE_SELECTOR = ".monaco-editor .view-line";
export const CHALLENGE_ID_PATH_REGEX = /^\/play\/([^/]+)/;
export const CHALLENGE_TITLE_REGEX = /Target\s*#?\d+\s*:\s*(.+)$/i;

import type { ElementDimensions } from "./shared/contracts";

export type { ElementDimensions };

export const resolveDocumentUrl = (url: string, baseUrl: string): string => {
	try {
		return new URL(url, baseUrl).href;
	} catch (_error) {
		return url;
	}
};

export const asImageDataUrlOrNull = (value: string | null | undefined): string | null =>
	typeof value === "string" && value.startsWith("data:image/") ? value : null;

export const getChallengeIdFromPathname = (pathname: string): string => {
	const match = pathname.match(CHALLENGE_ID_PATH_REGEX);
	return match?.[1] ?? "unknown";
};

export const getChallengeNameFromTitle = (
	title: string,
	challengeId: string
): string => {
	const trimmed = title.trim();
	const targetMatch = trimmed.match(CHALLENGE_TITLE_REGEX);
	if (targetMatch?.[1]) {
		return targetMatch[1].trim();
	}
	return `Target-${challengeId}`;
};

export const isSubmitControlText = (text: string): boolean => SUBMIT_LABEL.test(text);

export const dimensionsFromRect = (
	rect: DOMRect,
	devicePixelRatio = 1
): ElementDimensions | null => {
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

export const getElementDimensionsFromElement = (
	element: Element,
	devicePixelRatio = 1
): ElementDimensions | null =>
	dimensionsFromRect(element.getBoundingClientRect(), devicePixelRatio);

export const getElementDimensions = (
	root: Document | Element,
	selector: string,
	devicePixelRatio = 1
): ElementDimensions | null => {
	const element = root.querySelector(selector);
	if (!element) {
		return null;
	}
	return getElementDimensionsFromElement(element, devicePixelRatio);
};

const readInlineIframeSize = (iframe: HTMLIFrameElement): { width: number; height: number } => {
	const styleWidth = Number.parseFloat(iframe.style.width);
	const styleHeight = Number.parseFloat(iframe.style.height);
	const attrWidth = Number.parseFloat(iframe.getAttribute("width") ?? "");
	const attrHeight = Number.parseFloat(iframe.getAttribute("height") ?? "");
	return {
		width: styleWidth || attrWidth || 0,
		height: styleHeight || attrHeight || 0,
	};
};

const isVisiblePreviewIframe = (iframe: HTMLIFrameElement): boolean => {
	const rect = iframe.getBoundingClientRect();
	if (rect.width >= 80 && rect.height >= 80) {
		return true;
	}
	const inline = readInlineIframeSize(iframe);
	return inline.width >= 80 && inline.height >= 80;
};

export const findPreviewIframe = (
	root: Document | Element = document
): HTMLIFrameElement | null => {
	for (const selector of PREVIEW_IFRAME_SELECTORS) {
		const candidate = root.querySelector(selector);
		if (
			candidate instanceof HTMLIFrameElement &&
			isVisiblePreviewIframe(candidate)
		) {
			return candidate;
		}
	}

	let best: HTMLIFrameElement | null = null;
	let bestArea = 0;
	for (const candidate of Array.from(root.querySelectorAll("iframe"))) {
		if (!(candidate instanceof HTMLIFrameElement)) {
			continue;
		}
		if (!isVisiblePreviewIframe(candidate)) {
			continue;
		}
		const sandbox = candidate.getAttribute("sandbox") ?? "";
		if (!sandbox.includes("allow-same-origin")) {
			continue;
		}
		const rect = candidate.getBoundingClientRect();
		const inline = readInlineIframeSize(candidate);
		const width = rect.width > 0 ? rect.width : inline.width;
		const height = rect.height > 0 ? rect.height : inline.height;
		const area = width * height;
		if (area > bestArea) {
			bestArea = area;
			best = candidate;
		}
	}

	return best;
};

export const extractTargetAssetId = (url: string): string | null => {
	const match = url.match(TARGET_ASSET_ID_REGEX);
	return match?.[1] ?? null;
};

export const getTargetAssetIdFromImage = (img: HTMLImageElement): string | null => {
	const attrSrc = img.getAttribute("src") ?? "";
	if (attrSrc) {
		const fromAttr = extractTargetAssetId(attrSrc);
		if (fromAttr) {
			return fromAttr;
		}
	}
	return extractTargetAssetId(img.currentSrc ?? img.src ?? "");
};

export const buildCanonicalNumericTargetUrl = (
	challengeId: string,
	baseUrl: string
): string | null => {
	if (!isNumericChallengeId(challengeId)) {
		return null;
	}
	return resolveDocumentUrl(`/targets/${challengeId}.png`, baseUrl);
};

export const buildCanonicalDailyTargetUrl = (challengeId: string): string | null => {
	if (!challengeId || challengeId === "unknown" || isNumericChallengeId(challengeId)) {
		return null;
	}
	return `${DAILY_TARGET_IMAGEKIT_BASE}?id=${encodeURIComponent(challengeId)}`;
};

export const imageReferencesChallengeId = (url: string, challengeId: string): boolean => {
	if (!challengeId || challengeId === "unknown") {
		return true;
	}
	if (isNumericChallengeId(challengeId)) {
		return extractTargetAssetId(url) === challengeId;
	}
	return (
		url.includes(challengeId) ||
		url.includes(`id=${encodeURIComponent(challengeId)}`)
	);
};

export const findOgTargetImageUrl = (
	root: Document | Element,
	challengeId?: string
): string | null => {
	for (const meta of Array.from(
		root.querySelectorAll('meta[property="og:image"], meta[name="og:image"]')
	)) {
		const content = meta.getAttribute("content")?.trim();
		if (!content || !content.includes("target")) {
			continue;
		}
		if (!challengeId || challengeId === "unknown") {
			return content;
		}
		if (imageReferencesChallengeId(content, challengeId)) {
			return content;
		}
	}
	return null;
};

export const isFooterDecorativeImage = (img: HTMLImageElement): boolean =>
	Boolean(img.closest(FOOTER_DECORATIVE_IMAGE_SELECTOR));

export const targetAssetMatchesChallengeId = (
	img: HTMLImageElement,
	challengeId: string,
	baseUrl: string
): boolean => {
	if (!challengeId || challengeId === "unknown") {
		return true;
	}
	if (isFooterDecorativeImage(img)) {
		return false;
	}

	const url = getTargetImageUrl(img, baseUrl);
	if (isNumericChallengeId(challengeId)) {
		return extractTargetAssetId(url) === challengeId;
	}

	if (img.closest('[class*="container__item--target"], [class*="item--target"]')) {
		return true;
	}
	if (imageReferencesChallengeId(url, challengeId)) {
		return true;
	}
	return false;
};

export const scoreTargetImageCandidate = (
	img: HTMLImageElement,
	challengeId?: string
): number => {
	let score = 0;
	const src = img.getAttribute("src") ?? img.src ?? "";
	const currentSrc = img.currentSrc ?? "";
	const assetId =
		extractTargetAssetId(src) ?? extractTargetAssetId(currentSrc) ?? null;

	if (isCssBattleHostedTargetUrl(src) || isCssBattleHostedTargetUrl(currentSrc)) {
		score += 100;
	}
	if (
		src.includes("firebasestorage.googleapis.com") ||
		currentSrc.includes("firebasestorage.googleapis.com")
	) {
		score += 120;
	}

	const resolvedSrc = resolveDocumentUrl(src || currentSrc, "https://cssbattle.dev/");
	if (challengeId && challengeId !== "unknown") {
		if (imageReferencesChallengeId(resolvedSrc, challengeId)) {
			score += 1_000;
		} else if (isNumericChallengeId(challengeId) && assetId && assetId !== challengeId) {
			score -= 1_000;
		}
	}

	if (img.closest('[class*="container__item--target"], [class*="item--target"]')) {
		score += 250;
	}
	if (isFooterDecorativeImage(img)) {
		score -= 2_000;
	}

	const className = img.className.toString().toLowerCase();
	if (className.includes("levelpage__target")) {
		score += 80;
	} else if (className.includes("__target") || /\btarget\b/.test(className)) {
		score += 40;
	}

	const altText = (img.getAttribute("alt") ?? "").toLowerCase();
	if (altText.includes("target")) {
		score += 30;
	}
	if (altText.includes("battle")) {
		score += 15;
	}

	const width =
		img.naturalWidth ||
		img.width ||
		Number.parseInt(img.getAttribute("width") ?? "0", 10) ||
		0;
	if (width >= 200) {
		score += 20;
	}
	if (width >= 350) {
		score += 10;
	}
	if (width > 0 && width < 128) {
		score -= 50;
	}

	if (
		challengeId &&
		challengeId !== "unknown" &&
		!isNumericChallengeId(challengeId) &&
		(extractTargetAssetId(src) === "daily" || extractTargetAssetId(currentSrc) === "daily")
	) {
		score -= 500;
	}

	return score;
};

export const isTargetImageElement = (img: HTMLImageElement): boolean =>
	scoreTargetImageCandidate(img) >= 30;

const findLevelPageTargetImage = (
	root: Document | Element,
	challengeId: string | undefined,
	baseUrl: string
): HTMLImageElement | null => {
	const selectors = [...LEVEL_PAGE_TARGET_SELECTORS, ...TARGET_PANE_IMAGE_SELECTORS];
	for (const selector of selectors) {
		const candidate = root.querySelector(selector);
		if (!(candidate instanceof HTMLImageElement)) {
			continue;
		}
		if (!isTargetImageElement(candidate)) {
			continue;
		}
		if (
			challengeId &&
			challengeId !== "unknown" &&
			!targetAssetMatchesChallengeId(candidate, challengeId, baseUrl)
		) {
			continue;
		}
		return candidate;
	}
	return null;
};

const pickBestTargetImage = (
	root: Document | Element,
	challengeId: string | undefined,
	baseUrl: string
): HTMLImageElement | null => {
	const levelPageTarget = findLevelPageTargetImage(root, challengeId, baseUrl);
	if (levelPageTarget) {
		return levelPageTarget;
	}

	let best: HTMLImageElement | null = null;
	let bestScore = 0;

	for (const img of Array.from(root.querySelectorAll("img"))) {
		if (!(img instanceof HTMLImageElement)) {
			continue;
		}
		if (isFooterDecorativeImage(img)) {
			continue;
		}
		if (
			challengeId &&
			challengeId !== "unknown" &&
			!targetAssetMatchesChallengeId(img, challengeId, baseUrl)
		) {
			continue;
		}
		const score = scoreTargetImageCandidate(img, challengeId);
		if (score > bestScore) {
			bestScore = score;
			best = img;
		}
	}

	return bestScore >= 30 ? best : null;
};

const findTargetCanvas = (
	root: Document | Element
): HTMLCanvasElement | null => {
	for (const canvas of Array.from(root.querySelectorAll("canvas"))) {
		if (!(canvas instanceof HTMLCanvasElement)) {
			continue;
		}
		const className = canvas.className.toString().toLowerCase();
		if (
			className.includes("target") ||
			className.includes("levelpage") ||
			className.includes("levelpage__target")
		) {
			return canvas;
		}
	}
	return null;
};

export const getTargetImageUrl = (
	img: HTMLImageElement,
	baseUrl: string
): string => {
	const attrSrc = img.getAttribute("src") ?? "";
	if (attrSrc && !attrSrc.startsWith("data:")) {
		return resolveDocumentUrl(attrSrc, baseUrl);
	}
	const raw = img.currentSrc || img.src || "";
	return resolveDocumentUrl(raw, baseUrl);
};

export const findTargetImage = (
	root: Document | Element = document,
	baseUrl = typeof document !== "undefined" ? document.baseURI : "https://cssbattle.dev/",
	challengeId?: string
): { type: "dataUrl" | "url"; value: string } | null => {
	const img = pickBestTargetImage(root, challengeId, baseUrl);
	if (img) {
		const url = getTargetImageUrl(img, baseUrl);
		if (
			challengeId &&
			challengeId !== "unknown" &&
			!targetAssetMatchesChallengeId(img, challengeId, baseUrl)
		) {
			const canonical = buildCanonicalNumericTargetUrl(challengeId, baseUrl);
			if (canonical) {
				return { type: "url", value: canonical };
			}
		}
		return { type: "url", value: url };
	}

	const ogTarget = findOgTargetImageUrl(root, challengeId);
	if (ogTarget) {
		return { type: "url", value: ogTarget };
	}

	const numericCanonical = challengeId
		? buildCanonicalNumericTargetUrl(challengeId, baseUrl)
		: null;
	if (numericCanonical) {
		return { type: "url", value: numericCanonical };
	}

	const dailyCanonical = challengeId ? buildCanonicalDailyTargetUrl(challengeId) : null;
	if (dailyCanonical) {
		return { type: "url", value: dailyCanonical };
	}

	const canvasCandidate = findTargetCanvas(root);
	if (canvasCandidate) {
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

export const isPreviewIframeDocumentReady = (iframe: HTMLIFrameElement): boolean => {
	try {
		const doc = iframe.contentDocument;
		if (!doc?.body) {
			return false;
		}
		if (capturePreviewFromDocument(doc)) {
			return true;
		}
		if (doc.querySelector("svg")) {
			return true;
		}
		if (doc.body.children.length > 0) {
			return true;
		}
		const rect = doc.body.getBoundingClientRect();
		return rect.width >= 40 && rect.height >= 40;
	} catch (_error) {
		return false;
	}
};

/** Sync capture from preview iframe (canvas/img only; CSS previews use tab screenshot). */
export const capturePreviewFromIframeDocument = (
	iframe: HTMLIFrameElement
): string | null => {
	try {
		const doc = iframe.contentDocument;
		if (!doc) {
			return null;
		}
		return capturePreviewFromDocument(doc);
	} catch (_error) {
		return null;
	}
};

export const capturePreviewFromIframeDocumentAsync = async (
	iframe: HTMLIFrameElement
): Promise<string | null> => {
	try {
		const doc = iframe.contentDocument;
		if (!doc) {
			return null;
		}
		return capturePreviewFromDocumentAsync(doc);
	} catch (_error) {
		return null;
	}
};

export const waitForPreviewIframeReady = async (
	root: Document | Element = document,
	timeoutMs = 6_000,
	pollMs = 150
): Promise<HTMLIFrameElement | null> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const iframe = findPreviewIframe(root);
		if (iframe && isPreviewIframeDocumentReady(iframe)) {
			return iframe;
		}
		await new Promise((resolve) => window.setTimeout(resolve, pollMs));
	}
	return findPreviewIframe(root);
};

export const blobToDataUrl = (blob: Blob): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
				return;
			}
			reject(new Error("Failed to read image blob"));
		};
		reader.onerror = () => reject(reader.error ?? new Error("Failed to read image blob"));
		reader.readAsDataURL(blob);
	});

const fetchUrlViaExtensionBackground = async (url: string): Promise<string | null> => {
	const response = (await chrome.runtime.sendMessage({
		action: "fetchRemoteImage",
		url,
	})) as { ok?: boolean; data?: { dataUrl?: string }; error?: string };
	if (!response?.ok || typeof response.data?.dataUrl !== "string") {
		return null;
	}
	return response.data.dataUrl;
};

export const fetchUrlAsDataUrl = async (url: string): Promise<string | null> => {
	if (url.startsWith("data:")) {
		return url;
	}

	if (typeof chrome !== "undefined" && chrome.runtime?.id) {
		try {
			const fromBackground = await fetchUrlViaExtensionBackground(url);
			if (fromBackground) {
				return fromBackground;
			}
		} catch (_error) {
			// fall through
		}
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return null;
		}
		return blobToDataUrl(await response.blob());
	} catch (_error) {
		return null;
	}
};

export const waitForTargetImage = async (
	root: Document | Element = document,
	baseUrl = typeof document !== "undefined" ? document.baseURI : "https://cssbattle.dev/",
	challengeId?: string,
	timeoutMs = 8_000,
	pollMs = 200
): Promise<{ type: "dataUrl" | "url"; value: string } | null> => {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const found = findTargetImage(root, baseUrl, challengeId);
		if (found) {
			return found;
		}
		await new Promise((resolve) => window.setTimeout(resolve, pollMs));
	}
	return findTargetImage(root, baseUrl, challengeId);
};

/** Resolve and inline the challenge target image while still on the CSSBattle page. */
export const fetchTargetImagePayload = async (
	root: Document | Element = document,
	baseUrl = typeof document !== "undefined" ? document.baseURI : "https://cssbattle.dev/",
	challengeId?: string
): Promise<{ type: "dataUrl" | "url"; value: string } | null> => {
	const found = await waitForTargetImage(root, baseUrl, challengeId);
	if (!found) {
		return null;
	}
	if (found.type === "dataUrl") {
		return found;
	}
	const dataUrl = await fetchUrlAsDataUrl(found.value);
	return dataUrl ? { type: "dataUrl", value: dataUrl } : found;
};

const extractCodeFromLineElements = (root: Document | Element, selector: string): string => {
	const lines = Array.from(root.querySelectorAll(selector)).map((line) =>
		Array.from(line.childNodes)
			.map((node) => node.textContent ?? "")
			.join("")
	);
	return lines.join("\n").trim();
};

export const extractCodeFromCmLines = (root: Document | Element): string => {
	const fromCodeMirror = extractCodeFromLineElements(root, CM_LINE_SELECTOR);
	if (fromCodeMirror) {
		return fromCodeMirror;
	}
	return extractCodeFromLineElements(root, MONACO_LINE_SELECTOR);
};
