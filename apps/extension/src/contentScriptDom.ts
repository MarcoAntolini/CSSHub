/** Pure DOM helpers for the CSSBattle content script (testable without extension APIs). */

export const PREVIEW_SELECTOR = "iframe[title*='Preview' i]";
export const SUBMIT_LABEL = /submit/i;
export const CLICKABLE_SELECTOR =
	"button, [role='button'], input[type='submit'], a";
export const CM_LINE_SELECTOR = ".cm-line";
export const CHALLENGE_ID_PATH_REGEX = /^\/play\/([^/]+)/;
export const CHALLENGE_TITLE_REGEX = /Target\s*#?\d+\s*:\s*(.+)$/i;

export type ElementDimensions = {
	x: number;
	y: number;
	width: number;
	height: number;
};

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

export const getElementDimensions = (
	root: Document | Element,
	selector: string,
	devicePixelRatio = 1
): ElementDimensions | null => {
	const element = root.querySelector(selector);
	if (!element) {
		return null;
	}
	return dimensionsFromRect(element.getBoundingClientRect(), devicePixelRatio);
};

export const isTargetImageElement = (img: HTMLImageElement): boolean => {
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

export const findTargetImage = (
	root: Document | Element = document
): { type: "dataUrl" | "url"; value: string } | null => {
	for (const img of Array.from(root.querySelectorAll("img"))) {
		if (img instanceof HTMLImageElement && isTargetImageElement(img)) {
			return { type: "url", value: img.currentSrc || img.src };
		}
	}

	const canvasCandidate = root.querySelector("canvas");
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

export const extractCodeFromCmLines = (root: Document | Element): string => {
	const lines = Array.from(root.querySelectorAll(CM_LINE_SELECTOR)).map((line) =>
		Array.from(line.childNodes)
			.map((node) => node.textContent ?? "")
			.join("")
	);
	return lines.join("\n").trim();
};
