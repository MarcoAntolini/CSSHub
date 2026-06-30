import { describe, expect, it } from "vitest";
import { highlightFormatPreviewCode } from "@/formatPreviewHighlight";

describe("hex conversion edge cases", () => {
	it("logs full highlight output for prettified CSSBattle snippet", () => {
		const html = highlightFormatPreviewCode(`<div><p>asaasa</p></div>
<style>
& {
  background:
    repeating-linear-gradient(#62306d 0 10px, #f7bed9 10px 20px) 0 105px / 100% 90px no-repeat,
    #f7bed9;
}
* {
  background: #62306d;
  border-radius: 50%;
  width: 140;
  height: 140;
  margin: 80 -70;
  box-shadow: 400px 0 #62306d;
}
</style>`);

		const hexSpans = [...html.matchAll(/<span class="hljs-hex">#[0-9a-fA-F]+<\/span>/g)].map((m) => m[0]);
		const numberHexSpans = [...html.matchAll(/<span class="hljs-number">#[0-9a-fA-F]+<\/span>/g)].map((m) => m[0]);

		expect(numberHexSpans).toEqual([]);
		expect(hexSpans).toHaveLength(5);
	});

	it("does not leave hex values inside number spans after unit splitting", () => {
		const html = highlightFormatPreviewCode(
			"background: repeating-linear-gradient(#62306d 0 10px, #f7bed9 10px 20px);"
		);
		expect(html).not.toMatch(/class="hljs-number">#[0-9a-fA-F]/);
		expect(html.match(/class="hljs-hex">#[0-9a-fA-F]+/g)).toHaveLength(2);
	});
});
