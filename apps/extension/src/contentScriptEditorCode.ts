import { extractCodeFromCmLines } from "./contentScriptDom";

export const readCssbattleEditorCode = async (): Promise<string> => {
	try {
		const response = (await chrome.runtime.sendMessage({
			action: "extractCssbattleEditorCode",
		})) as { ok?: boolean; data?: { code?: string | null }; error?: string };
		if (response?.ok && response.data && "code" in response.data) {
			const fromEditor = response.data.code;
			if (typeof fromEditor === "string" && fromEditor.trim()) {
				return fromEditor.trim();
			}
		}
	} catch (_error) {
		// Extension context invalidated — fall back to visible editor lines.
	}

	return extractCodeFromCmLines(document);
};
