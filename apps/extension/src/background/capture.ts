import { elementDimensionsSchema, type ElementDimensions } from "@/shared/contracts";

export const PREVIEW_FRAME_CAPTURE_INJECT_FILE = "previewFrameCaptureInject.js";

const toBase64 = (bytes: Uint8Array): string => {
	let output = "";
	for (const value of bytes) {
		output += String.fromCharCode(value);
	}
	return btoa(output);
};

const cropImageDataUrl = async (
	dataUrl: string,
	dimensions: ElementDimensions
): Promise<string> => {
	const sourceBlob = await (await fetch(dataUrl)).blob();
	const bitmap = await createImageBitmap(sourceBlob);
	const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Unable to create canvas context");
	}

	context.drawImage(
		bitmap,
		dimensions.x,
		dimensions.y,
		dimensions.width,
		dimensions.height,
		0,
		0,
		dimensions.width,
		dimensions.height
	);

	const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
	const bytes = new Uint8Array(await croppedBlob.arrayBuffer());
	return `data:image/png;base64,${toBase64(bytes)}`;
};

/** Serialized into child frames after previewFrameCaptureInject.js loads. */
const invokeInjectedPreviewCapture = (): Promise<string | null> =>
	(
		globalThis as unknown as {
			__csshubCapturePreviewInFrame?: () => Promise<string | null>;
		}
	).__csshubCapturePreviewInFrame?.() ?? Promise.resolve(null);

export const capturePreviewFromAllTabFrames = async (
	tabId: number
): Promise<string | null> => {
	await chrome.scripting.executeScript({
		target: { tabId, allFrames: true },
		files: [PREVIEW_FRAME_CAPTURE_INJECT_FILE],
	});

	const results = await chrome.scripting.executeScript({
		target: { tabId, allFrames: true },
		func: invokeInjectedPreviewCapture,
	});

	for (const result of results) {
		const value = result.result;
		if (typeof value === "string" && value.startsWith("data:image/")) {
			return value;
		}
	}
	return null;
};

type CaptureTabFn = (
	tabId: number,
	options: { format: "png" },
	callback?: (dataUrl: string | undefined) => void
) => Promise<string> | void;

const captureViaCallback = (
	capture: (callback: (dataUrl: string | undefined) => void) => void
): Promise<string> =>
	new Promise((resolve, reject) => {
		capture((dataUrl) => {
			const lastError = chrome.runtime.lastError;
			if (lastError) {
				reject(new Error(lastError.message));
				return;
			}
			if (!dataUrl) {
				reject(new Error("Capture failed"));
				return;
			}
			resolve(dataUrl);
		});
	});

const getTabById = async (tabId: number): Promise<chrome.tabs.Tab> =>
	new Promise((resolve, reject) => {
		chrome.tabs.get(tabId, (tab) => {
			const lastError = chrome.runtime.lastError;
			if (lastError) {
				reject(new Error(lastError.message));
				return;
			}
			resolve(tab);
		});
	});

export const captureTabPng = async (tabId: number): Promise<string> => {
	const tab = await getTabById(tabId);
	if (!isCssBattlePlayUrl(tab.url)) {
		throw new Error("Capture tab URL is not a CSSBattle play page");
	}

	await chrome.tabs.update(tabId, { active: true });
	await new Promise((resolve) => setTimeout(resolve, 100));

	const tabsApi = chrome.tabs as typeof chrome.tabs & {
		captureTab?: CaptureTabFn;
	};

	if (typeof tabsApi.captureTab === "function") {
		try {
			const maybePromise = tabsApi.captureTab(tabId, { format: "png" });
			if (maybePromise instanceof Promise) {
				return await maybePromise;
			}
		} catch (_error) {
			// fall through to callback form
		}

		return captureViaCallback((callback) => {
			tabsApi.captureTab!(tabId, { format: "png" }, callback);
		});
	}

	if (typeof tab.windowId !== "number") {
		throw new Error("Tab has no window");
	}

	return captureViaCallback((callback) => {
		chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" }, callback);
	});
};

export const captureElement = async (
	dimensions: ElementDimensions,
	tabId: number
): Promise<string> => {
	const dataUrl = await captureTabPng(tabId);
	return cropImageDataUrl(dataUrl, dimensions);
};

export const CONTENT_SCRIPT_FILE = "contentScript.js";
export const RECEIVING_END_MISSING = "Receiving end does not exist";

export const isCssBattlePlayUrl = (url: string | undefined): boolean => {
	if (!url) {
		return false;
	}

	try {
		const parsed = new URL(url);
		return (
			(parsed.hostname === "cssbattle.dev" ||
				parsed.hostname === "www.cssbattle.dev") &&
			parsed.pathname.startsWith("/play/")
		);
	} catch (_error) {
		return false;
	}
};

export const queryActiveTab = async (): Promise<chrome.tabs.Tab | null> =>
	new Promise((resolve) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			resolve(tabs[0] ?? null);
		});
	});

export const injectContentScript = async (tabId: number): Promise<void> =>
	new Promise((resolve, reject) => {
		chrome.scripting.executeScript(
			{
				target: { tabId },
				files: [CONTENT_SCRIPT_FILE],
			},
			() => {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message));
					return;
				}
				resolve();
			}
		);
	});

export const getElementDimensionsFromTab = async (
	tabId: number,
	selector: string
): Promise<ElementDimensions> =>
	new Promise((resolve, reject) => {
		chrome.tabs.sendMessage(
			tabId,
			{
				action: "getElementPositionAndDimensions",
				selector,
			},
			(response) => {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message));
					return;
				}

				const dimensions = elementDimensionsSchema.safeParse(response);
				if (!dimensions.success) {
					reject(new Error("Could not find capture area"));
					return;
				}

				resolve(dimensions.data);
			}
		);
	});
