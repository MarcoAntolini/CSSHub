import { describe, expect, it } from "vitest";
import { resolveCssBattleImageUrl } from "@/submission/cssBattleAssets";

describe("resolveCssBattleImageUrl", () => {
	it("resolves relative target paths against the challenge page", () => {
		expect(
			resolveCssBattleImageUrl(
				"/targets/254.png",
				"https://cssbattle.dev/play/254"
			)
		).toBe("https://cssbattle.dev/targets/254.png");
	});

	it("falls back to cssbattle.dev when challenge URL is missing", () => {
		expect(resolveCssBattleImageUrl("/targets/42.png")).toBe(
			"https://cssbattle.dev/targets/42.png"
		);
	});

	it("returns data URLs unchanged", () => {
		const dataUrl = "data:image/png;base64,abc";
		expect(resolveCssBattleImageUrl(dataUrl)).toBe(dataUrl);
	});
});
