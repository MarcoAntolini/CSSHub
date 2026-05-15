import type { ElementDimensions } from "../../shared/contracts";
import {
	captureElement,
	getElementDimensionsFromTab,
	injectContentScript,
	isCssBattlePlayUrl,
	queryActiveTab,
	RECEIVING_END_MISSING,
} from "../capture";
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
		let dimensions: ElementDimensions;
		try {
			dimensions = await getElementDimensionsFromTab(tab.id, data.selector);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (
				!message.includes(RECEIVING_END_MISSING) ||
				!isCssBattlePlayUrl(tab.url)
			) {
				throw error;
			}

			await injectContentScript(tab.id);
			dimensions = await getElementDimensionsFromTab(tab.id, data.selector);
		}

		const croppedDataUrl = await captureElement(dimensions);
		sendResponse({ ok: true, data: { croppedDataUrl } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Capture failed";
		sendResponse({ ok: false, error: message });
	}
};
