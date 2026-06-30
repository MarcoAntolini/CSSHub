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
export function readCodeMirror6DocumentFromPage(): string | null {
	type InjectedCodeMirrorDocument = {
		length: number;
		toString(): string;
	};
	type InjectedCodeMirrorEditorView = {
		dispatch: (spec: unknown) => void;
		state: { doc: InjectedCodeMirrorDocument };
	};
	type InjectedCodeMirrorViewHost = HTMLElement & {
		cmView?: InjectedCodeMirrorEditorView | { view?: unknown };
		cmTile?: InjectedCodeMirrorEditorView | { view?: unknown };
		editorView?: unknown;
		view?: unknown;
	};
	const isView = (candidate: unknown): candidate is InjectedCodeMirrorEditorView => {
		if (!candidate || typeof candidate !== "object") {
			return false;
		}
		const editorView = candidate as Partial<InjectedCodeMirrorEditorView>;
		return (
			typeof editorView.dispatch === "function" &&
			typeof editorView.state?.doc?.length === "number" &&
			typeof editorView.state.doc.toString === "function"
		);
	};
	const fromHost = (host: HTMLElement | null): InjectedCodeMirrorEditorView | null => {
		if (!host) {
			return null;
		}
		const viewHost = host as InjectedCodeMirrorViewHost;
		const candidates = [
			viewHost.cmView,
			viewHost.cmView && "view" in viewHost.cmView ? viewHost.cmView.view : undefined,
			viewHost.cmTile,
			viewHost.cmTile && "view" in viewHost.cmTile ? viewHost.cmTile.view : undefined,
			viewHost.editorView,
			viewHost.view,
		];
		for (const candidate of candidates) {
			if (isView(candidate)) {
				return candidate;
			}
		}
		return null;
	};
	const getView = (): InjectedCodeMirrorEditorView | null => {
		const root = document.querySelector(".cm-editor .cm-content, .cm-content");
		if (!(root instanceof HTMLElement)) {
			return null;
		}
		const rootView = fromHost(root);
		if (rootView) {
			return rootView;
		}
		const editor = root.closest(".cm-editor");
		return editor instanceof HTMLElement ? fromHost(editor) : null;
	};
	const readLines = (selector: string): string => {
		const lines = document.querySelectorAll(selector);
		if (lines.length === 0) {
			return "";
		}
		return Array.from(lines)
			.map((line) =>
				Array.from(line.childNodes)
					.map((node) => node.textContent ?? "")
					.join("")
			)
			.join("\n")
			.trim();
	};

	const view = getView();
	if (view) {
		return view.state.doc.toString();
	}

	const fromDom = readLines(".cm-line") || readLines(".monaco-editor .view-line");
	return fromDom || null;
}

/** Serialized into the page MAIN world; must stay self-contained for `executeScript`. */
export function writeCodeMirror6DocumentFromPage(code: string): boolean {
	type InjectedCodeMirrorDocument = {
		length: number;
		toString(): string;
	};
	type InjectedCodeMirrorEditorView = {
		dispatch: (spec: unknown) => void;
		state: { doc: InjectedCodeMirrorDocument };
	};
	type InjectedCodeMirrorViewHost = HTMLElement & {
		cmView?: InjectedCodeMirrorEditorView | { view?: unknown };
		cmTile?: InjectedCodeMirrorEditorView | { view?: unknown };
		editorView?: unknown;
		view?: unknown;
	};
	const isView = (candidate: unknown): candidate is InjectedCodeMirrorEditorView => {
		if (!candidate || typeof candidate !== "object") {
			return false;
		}
		const editorView = candidate as Partial<InjectedCodeMirrorEditorView>;
		return (
			typeof editorView.dispatch === "function" &&
			typeof editorView.state?.doc?.length === "number" &&
			typeof editorView.state.doc.toString === "function"
		);
	};
	const fromHost = (host: HTMLElement | null): InjectedCodeMirrorEditorView | null => {
		if (!host) {
			return null;
		}
		const viewHost = host as InjectedCodeMirrorViewHost;
		const candidates = [
			viewHost.cmView,
			viewHost.cmView && "view" in viewHost.cmView ? viewHost.cmView.view : undefined,
			viewHost.cmTile,
			viewHost.cmTile && "view" in viewHost.cmTile ? viewHost.cmTile.view : undefined,
			viewHost.editorView,
			viewHost.view,
		];
		for (const candidate of candidates) {
			if (isView(candidate)) {
				return candidate;
			}
		}
		return null;
	};
	const getView = (): InjectedCodeMirrorEditorView | null => {
		const root = document.querySelector(".cm-editor .cm-content, .cm-content");
		if (!(root instanceof HTMLElement)) {
			return null;
		}
		const rootView = fromHost(root);
		if (rootView) {
			return rootView;
		}
		const editor = root.closest(".cm-editor");
		return editor instanceof HTMLElement ? fromHost(editor) : null;
	};

	const view = getView();
	if (view) {
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: code },
		});
		return true;
	}

	const editable = document.querySelector(
		".cm-editor [contenteditable='true'], .cm-editor [contenteditable=''], [contenteditable='true']"
	);
	if (editable instanceof HTMLElement) {
		editable.focus();
		editable.textContent = code;
		editable.dispatchEvent(
			new InputEvent("input", { bubbles: true, cancelable: true, inputType: "insertText", data: code })
		);
		return true;
	}

	return false;
}

export const handleApplyCssbattleEditorCode: Handler<"applyCssbattleEditorCode"> = async (
	data,
	sendResponse,
	sender
) => {
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
			func: writeCodeMirror6DocumentFromPage,
			args: [data.code],
		});
		const applied = injectionResult?.result === true;
		if (!applied) {
			sendResponse({ ok: false, error: "Could not update CSSBattle editor" });
			return;
		}
		sendResponse({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Editor write failed";
		sendResponse({ ok: false, error: message });
	}
};

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
			} catch (_screenshotError) {
				// Fall through to iframe-frame capture below.
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
