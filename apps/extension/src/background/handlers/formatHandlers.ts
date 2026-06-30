import { formatEditorCode } from "@/submission/codeFormatting";
import type { Handler } from "./types";

export const handleFormatCssbattleEditorCode: Handler<
	"formatCssbattleEditorCode"
> = async (data, sendResponse) => {
	try {
		const code = await formatEditorCode(data.code, data.format);
		sendResponse({ ok: true, data: { code } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Code formatting failed";
		sendResponse({ ok: false, error: message });
	}
};
