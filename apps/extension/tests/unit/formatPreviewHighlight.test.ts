import { describe, expect, it } from "vitest";
import { highlightFormatPreviewCode } from "@/formatPreviewHighlight";

describe("highlightFormatPreviewCode", () => {
	it("highlights HTML/CSSBattle markup", () => {
		const html = highlightFormatPreviewCode(
			`<style>
& {
	color: red;
}
</style>`
		);
		expect(html).toContain('<span class="hljs-tag">');
		expect(html).toContain("color");
	});

	it("highlights bare CSS snippets", () => {
		const css = highlightFormatPreviewCode("body { margin: 0; }");
		expect(css).toContain('<span class="hljs-selector-tag">');
		expect(css).toContain("margin");
	});

	it("marks hex colors separately from numeric values", () => {
		const html = highlightFormatPreviewCode("body { color: #62306d; }");
		expect(html).toContain('class="hljs-hex">#62306d');
	});

	it("colors CSSBattle selectors and operators", () => {
		const html = highlightFormatPreviewCode(`<style>
& {
  background: #62306d;
  * { margin: 80 -70; }
}
</style>`);
		expect(html).toContain('<span class="hljs-csb-selector">&</span>');
		expect(html).toContain('<span class="hljs-csb-selector">*</span>');
		expect(html).toContain('<span class="hljs-csb-operator">:</span>');
		expect(html).toContain('<span class="hljs-csb-operator">-</span>');
	});

	it("highlights minified CSSBattle code", () => {
		const html = highlightFormatPreviewCode(
			"<style>&{margin:80-70;*{width:140;}background:repeating-linear-gradient(#62306d 0 10px,#f7bed9 10px 20px)0 105px/100%90px no-repeat;}</style>"
		);
		expect(html).toContain('<span class="hljs-csb-selector">&</span>');
		expect(html).toContain('<span class="hljs-csb-selector">*</span>');
		expect(html).toContain('<span class="hljs-csb-operator">/</span>');
		expect(html).toContain('<span class="hljs-csb-operator">-</span>');
	});

	it("highlights minified HTML/CSS without a closing style tag", () => {
		const html = highlightFormatPreviewCode(
			"<div><p>asaasa</p></div><style>&{background:#62306d;*{margin:80-70;box-shadow:400px 0#62306d}"
		);
		expect(html).not.toContain('class="language-css"');
		expect(html).toContain('<span class="hljs-csb-selector">&</span>');
		expect(html).toContain('<span class="hljs-csb-selector">*</span>');
		expect(html).toContain('class="hljs-hex">#62306d');
		expect(html).toContain('<span class="hljs-csb-operator">:</span>');
		expect(html).toContain('<span class="hljs-csb-operator">-</span>');
	});

	it("highlights hex colors in prettified CSSBattle gradients", () => {
		const html = highlightFormatPreviewCode(`<style>
& {
  background:
    repeating-linear-gradient(#62306d 0 10px, #f7bed9 10px 20px) 0 105px / 100% 90px no-repeat,
    #f7bed9;
}
* {
  background: #62306d;
  box-shadow: 400px 0 #62306d;
}
</style>`);
		expect(html).toContain('class="hljs-hex">#62306d');
		expect(html).toContain('class="hljs-hex">#f7bed9');
		expect(html).not.toMatch(/class="hljs-number">#[0-9a-fA-F]/);
	});
});
