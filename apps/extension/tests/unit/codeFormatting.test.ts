import { describe, expect, it } from "vitest";
import { minifySubmissionCode } from "@/submission/codeFormatting";

describe("minifySubmissionCode", () => {
	it.each([
		[
			`
<style>
& {
scale: 0.070 0.50;
}
</style>`,
			"<style>&{scale:.07.5",
		],
		[
			`
<style>
& {
scale: 1.07 0.5;
}
</style>`,
			"<style>&{scale:1.07.5",
		],
		[
			`
<style>
& {
color: transparent;
}
</style>`,
			"<style>&{color:#0000",
		],
		[
			`
<style>
& {
background: white
}
p {
background: red;
}
</style>`,
			"<style>&{background:white}p{background:red",
		],
		[
			`
<style>
* {
border: solid #394257 0.63em;
}
</style>`,
			"<style>*{border:solid#394257.63em",
		],
		["solid transparent 0.63em;", "solid#0000.63em"],
	])("minifies %#", (pretty, minified) => {
		expect(minifySubmissionCode(pretty)).toEqual(minified);
		expect(minifySubmissionCode(minified)).toEqual(minified);
	});
});
