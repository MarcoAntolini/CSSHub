// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readCssbattleEditorCode } from "@/contentScriptEditorCode";

describe("readCssbattleEditorCode", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div class="cm-editor">
				<div class="cm-line">&lt;style&gt;</div>
				<div class="cm-line">*{margin:0}</div>
			</div>
		`;
		vi.stubGlobal("chrome", {
			runtime: {
				sendMessage: vi.fn().mockResolvedValue({
					ok: true,
					data: { code: null },
				}),
			},
		});
	});

	it("falls back to visible CodeMirror lines when background read returns null", async () => {
		const code = await readCssbattleEditorCode();
		expect(code).toContain("<style>");
		expect(code).toContain("*{margin:0}");
	});
});
