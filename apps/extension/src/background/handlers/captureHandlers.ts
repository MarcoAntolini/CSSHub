import type { ElementDimensions } from "@/shared/contracts";
import {
	captureElement,
	capturePreviewFromAllTabFrames,
	getElementDimensionsFromTab,
	injectContentScript,
	isCssBattlePlayUrl,
	queryActiveTab,
	RECEIVING_END_MISSING,
} from "@/background/capture";
import type { Handler } from "./types";

/** Serialized into the page MAIN world; must stay self-contained for `executeScript`. */
function readCodeMirror6DocumentFromPage(): string | null {
	const root = document.querySelector(".cm-editor .cm-content, .cm-content");
	if (!(root instanceof HTMLElement)) {
		return null;
	}
	const tile = (
		root as HTMLElement & { cmTile?: { view?: { state?: { doc?: { toString(): string } } } } }
	).cmTile;
	const doc = tile?.view?.state?.doc;
	if (doc && typeof doc.toString === "function") {
		return doc.toString();
	}
	return null;
}

export const handleExtractCssbattleEditorCode: Handler<
	"extractCssbattleEditorCode"
> = async (_data, sendResponse, sender) => {
	const tab = sender.tab;
	const tabId = tab?.id;
	if (!tabId || !isCssBattlePlayUrl(tab.url)) {
		sendResponse({ ok: false, error: "No CSSBattle play tab" });
		return;
	}

	try {
		const [injectionResult] = await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: readCodeMirror6DocumentFromPage,
		});
		const raw = injectionResult?.result;
		const code = typeof raw === "string" ? raw : null;
		sendResponse({ ok: true, data: { code } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Editor read failed";
		sendResponse({ ok: false, error: message });
	}
};

export const handleCapturePreview: Handler<"capturePreview"> = async (
	data,
	sendResponse,
	sender
) => {
	const tab = sender.tab ?? (await queryActiveTab());
	if (!tab?.id) {
		sendResponse({ ok: false, error: "No active tab found" });
		return;
	}

	try {
		if (data.dimensions) {
			try {
				const croppedDataUrl = await captureElement(data.dimensions, tab.id);
				sendResponse({ ok: true, data: { croppedDataUrl } });
				return;
			} catch (screenshotError) {
				console.warn("[CssHub] Tab screenshot capture failed, trying iframe frames", screenshotError);
			}
		}

		if (isCssBattlePlayUrl(tab.url)) {
			const fromFrame = await capturePreviewFromAllTabFrames(tab.id);
			if (fromFrame) {
				sendResponse({ ok: true, data: { croppedDataUrl: fromFrame } });
				return;
			}
		}

		sendResponse({ ok: false, error: "Preview capture failed" });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Capture failed";
		sendResponse({ ok: false, error: message });
	}
};

export const handleCaptureElement: Handler<"captureElement"> = async (
	data,
	sendResponse,
	sender
) => {
	const tab = sender.tab ?? (await queryActiveTab());
	if (!tab?.id) {
		sendResponse({ ok: false, error: "No active tab found" });
		return;
	}

	try {
		let dimensions: ElementDimensions | undefined = data.dimensions;
		if (!dimensions) {
			const selector = data.selector;
			if (!selector) {
				sendResponse({ ok: false, error: "No capture selector provided" });
				return;
			}
			try {
				dimensions = await getElementDimensionsFromTab(tab.id, selector);
			} catch (error) {
				const message = error instanceof Error ? error.message : "";
				if (
					!message.includes(RECEIVING_END_MISSING) ||
					!isCssBattlePlayUrl(tab.url)
				) {
					throw error;
				}

				await injectContentScript(tab.id);
				dimensions = await getElementDimensionsFromTab(tab.id, selector);
			}
		}

		const croppedDataUrl = await captureElement(dimensions, tab.id);
		sendResponse({ ok: true, data: { croppedDataUrl } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Capture failed";
		sendResponse({ ok: false, error: message });
	}
};
