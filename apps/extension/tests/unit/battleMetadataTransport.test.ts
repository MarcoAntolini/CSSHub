import { describe, expect, it, vi } from "vitest";

import { parseCssbattleBattleMetadata } from "@/cssbattleBattleMetadata";
import {
	readBattleMetadataHtmlWithFallbacks,
	toHydratedBattleMetadataHtml,
} from "@/background/battleMetadataTransport";

describe("toHydratedBattleMetadataHtml", () => {
	it("creates HTML that the existing parser can read", () => {
		const html = toHydratedBattleMetadataHtml({
			totalChallenges: 3,
			status: "finished",
		});

		expect(parseCssbattleBattleMetadata(html)).toEqual({
			totalChallenges: 3,
			status: "finished",
		});
	});
});

describe("readBattleMetadataHtmlWithFallbacks", () => {
	const url = "https://cssbattle.dev/battle/1";

	it("uses offscreen hydration first and skips later fallbacks", async () => {
		const readViaOffscreen = vi.fn().mockResolvedValue({
			totalChallenges: 2,
			status: "unfinished",
		});
		const readViaInactiveTab = vi.fn();
		const fetchHtml = vi.fn();

		const html = await readBattleMetadataHtmlWithFallbacks(url, {
			readViaOffscreen,
			readViaInactiveTab,
			fetchHtml,
			onHydratedReadFailure: vi.fn(),
		});

		expect(parseCssbattleBattleMetadata(html).totalChallenges).toBe(2);
		expect(readViaOffscreen).toHaveBeenCalledWith(url);
		expect(readViaInactiveTab).not.toHaveBeenCalled();
		expect(fetchHtml).not.toHaveBeenCalled();
	});

	it("falls back to inactive tab when offscreen throws", async () => {
		const readViaOffscreen = vi.fn().mockRejectedValue(new Error("offscreen failed"));
		const readViaInactiveTab = vi.fn().mockResolvedValue({
			totalChallenges: 4,
			status: "finished",
		});
		const fetchHtml = vi.fn();
		const onHydratedReadFailure = vi.fn();

		const html = await readBattleMetadataHtmlWithFallbacks(url, {
			readViaOffscreen,
			readViaInactiveTab,
			fetchHtml,
			onHydratedReadFailure,
		});

		expect(parseCssbattleBattleMetadata(html)).toEqual({
			totalChallenges: 4,
			status: "finished",
		});
		expect(readViaInactiveTab).toHaveBeenCalledWith(url);
		expect(fetchHtml).not.toHaveBeenCalled();
		expect(onHydratedReadFailure).toHaveBeenCalledOnce();
	});

	it("falls back to inactive tab when offscreen cannot find a count", async () => {
		const readViaOffscreen = vi.fn().mockResolvedValue({
			totalChallenges: null,
			status: "unfinished",
		});
		const readViaInactiveTab = vi.fn().mockResolvedValue({
			totalChallenges: 5,
			status: "unfinished",
		});

		const html = await readBattleMetadataHtmlWithFallbacks(url, {
			readViaOffscreen,
			readViaInactiveTab,
			fetchHtml: vi.fn(),
			onHydratedReadFailure: vi.fn(),
		});

		expect(parseCssbattleBattleMetadata(html).totalChallenges).toBe(5);
		expect(readViaInactiveTab).toHaveBeenCalledWith(url);
	});

	it("uses raw fetch when both hydrated readers fail", async () => {
		const rawHtml = `
			<section class="targets-container">
				<a href="/play/1">One</a>
			</section>
		`;
		const fetchHtml = vi.fn().mockResolvedValue(rawHtml);

		await expect(
			readBattleMetadataHtmlWithFallbacks(url, {
				readViaOffscreen: vi.fn().mockRejectedValue(new Error("offscreen failed")),
				readViaInactiveTab: vi.fn().mockRejectedValue(new Error("tab failed")),
				fetchHtml,
				onHydratedReadFailure: vi.fn(),
			})
		).resolves.toBe(rawHtml);
		expect(fetchHtml).toHaveBeenCalledWith(url);
	});
});
