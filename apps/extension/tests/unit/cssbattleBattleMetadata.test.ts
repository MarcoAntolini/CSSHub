import { describe, expect, it, vi } from "vitest";

import {
	getCssbattleBattleMetadata,
	parseCssbattleBattleMetadata,
	type CssbattleBattleMetadataCache,
} from "@/cssbattleBattleMetadata";

describe("parseCssbattleBattleMetadata", () => {
	it("counts unique play links inside the targets container", () => {
		const html = `
			<section class="targets-container">
				<a href="/play/1">Play target number 1</a>
				<a href="/play/2">Play target number 2</a>
				<a href="/play/2">Duplicate target link</a>
				<a href="/battle/1">Battle</a>
			</section>
			<a href="/play/999">Footer link outside target area</a>
		`;

		expect(parseCssbattleBattleMetadata(html)).toEqual({
			totalChallenges: 2,
			status: "unfinished",
		});
	});

	it("counts play links inside a nested div targets container", () => {
		const html = `
			<div class="targets-container">
				<div class="target-tile">
					<div class="target-top-info"><p>#1</p></div>
					<div>
						<a class="shadow-link" title="Play target number 1" href="/play/1"></a>
					</div>
				</div>
				<div class="target-tile">
					<div class="target-top-info"><p>#2</p></div>
					<div>
						<a class="shadow-link" title="Play target number 2" href="/play/2"></a>
					</div>
				</div>
			</div>
			<a href="/play/999">Outside target area</a>
		`;

		expect(parseCssbattleBattleMetadata(html)).toEqual({
			totalChallenges: 2,
			status: "unfinished",
		});
	});

	it("counts target tiles inside the targets container when links are not available", () => {
		const html = `
			<div class="targets-container">
				<div class="target-tile">#1. Simply Square</div>
				<div class="target-tile">#2. Carrom</div>
				<div class="target-tile">#3. Push Button</div>
			</div>
		`;

		expect(parseCssbattleBattleMetadata(html)).toEqual({
			totalChallenges: 3,
			status: "unfinished",
		});
	});

	it("detects finished battles from a status pill", () => {
		const html = `
			<div class="targets-container">
				<div class="target-tile">#1. Simply Square</div>
			</div>
			<span class="battle-status-pill">FINISHED</span>
		`;

		expect(parseCssbattleBattleMetadata(html)).toEqual({
			totalChallenges: 1,
			status: "finished",
		});
	});

	it("treats unfamiliar or missing badges as unfinished", () => {
		const html = `
			<div class="targets-container">
				<span class="badge">LIVE</span>
				<a href="/play/1">Play target number 1</a>
			</div>
		`;

		expect(parseCssbattleBattleMetadata(html).status).toBe("unfinished");
	});

	it("returns null total for loading-only or malformed overview HTML", () => {
		expect(parseCssbattleBattleMetadata("Fetching battle details...")).toEqual({
			totalChallenges: null,
			status: "unfinished",
		});
	});
});

describe("getCssbattleBattleMetadata", () => {
	it("reuses finished cached metadata without refetching", async () => {
		const cache: CssbattleBattleMetadataCache = {
			"1": {
				battleId: "1",
				totalChallenges: 8,
				status: "finished",
				fetchedAt: "2026-06-17T00:00:00.000Z",
			},
		};
		const fetchHtml = vi.fn();

		const result = await getCssbattleBattleMetadata("1", cache, fetchHtml);

		expect(result.metadata).toEqual(cache["1"]);
		expect(result.cache).toEqual(cache);
		expect(fetchHtml).not.toHaveBeenCalled();
	});

	it("refreshes unfinished cached metadata", async () => {
		const cache: CssbattleBattleMetadataCache = {
			"1": {
				battleId: "1",
				totalChallenges: 4,
				status: "unfinished",
				fetchedAt: "2026-06-17T00:00:00.000Z",
			},
		};
		const fetchHtml = vi.fn().mockResolvedValue(`
			<div class="targets-container">
				<a href="/play/1">1</a>
				<a href="/play/2">2</a>
				<span>FINISHED</span>
			</div>
		`);

		const result = await getCssbattleBattleMetadata("1", cache, fetchHtml);

		expect(fetchHtml).toHaveBeenCalledWith("https://cssbattle.dev/battle/1");
		expect(result.metadata).toMatchObject({
			battleId: "1",
			totalChallenges: 2,
			status: "finished",
		});
		expect(result.cache["1"]).toEqual(result.metadata);
	});

	it("does not cache unknown metadata over a known unfinished count", async () => {
		const cache: CssbattleBattleMetadataCache = {
			"1": {
				battleId: "1",
				totalChallenges: 4,
				status: "unfinished",
				fetchedAt: "2026-06-17T00:00:00.000Z",
			},
		};
		const fetchHtml = vi.fn().mockResolvedValue("Fetching battle details...");

		const result = await getCssbattleBattleMetadata("1", cache, fetchHtml);

		expect(result.metadata).toMatchObject({
			battleId: "1",
			totalChallenges: null,
			status: "unfinished",
		});
		expect(result.cache).toEqual(cache);
	});
});
