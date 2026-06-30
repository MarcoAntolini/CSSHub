// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { formatPreviewShadowStyles } from "@/cssbattleEditorTheme";
import { highlightFormatPreviewCode } from "@/formatPreviewHighlight";

describe("format preview hex styling", () => {
	it("applies CSSBattle grey hex color inside the preview panel", () => {
		const panel = document.createElement("div");
		panel.className = "csshub-formatting-preview-code";
		const style = document.createElement("style");
		style.textContent = formatPreviewShadowStyles;
		const code = document.createElement("code");
		code.className = "hljs";
		code.innerHTML = highlightFormatPreviewCode("body { color: #62306d; }");
		panel.append(code);
		document.body.append(style, panel);

		const hex = code.querySelector(".hljs-hex") as HTMLElement;
		expect(hex).toBeTruthy();
		expect(getComputedStyle(hex).color).toBe("rgb(108, 103, 131)");

		panel.remove();
		style.remove();
	});
});
