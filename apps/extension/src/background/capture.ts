import { elementDimensionsSchema, type ElementDimensions } from "../shared/contracts";

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

export const captureElement = async (
	dimensions: ElementDimensions
): Promise<string> =>
	new Promise((resolve, reject) => {
		chrome.tabs.captureVisibleTab({ format: "png" }, async (dataUrl) => {
			try {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message));
					return;
				}
				if (!dataUrl) {
					reject(new Error("Capture failed"));
					return;
				}
				const croppedDataUrl = await cropImageDataUrl(dataUrl, dimensions);
				resolve(croppedDataUrl);
			} catch (error) {
				reject(error);
			}
		});
	});

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
