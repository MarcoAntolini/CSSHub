// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { pollHydratedBattlePageMetadata } from "@/background/handlers/battleMetadata";

describe("pollHydratedBattlePageMetadata", () => {
	it("waits for client-rendered battle metadata to appear and stabilize", async () => {
		document.body.innerHTML = "Loading battle...";
		window.setTimeout(() => {
			document.body.innerHTML = `
				<section class="targets-container">
					<a href="/play/3">#3. Push Button</a>
					<a href="/play/4">#4. Ups n Downs</a>
					<a href="/play/5">#5. Acid Rain</a>
					<a href="/play/6">#6. Missing Slice</a>
				</section>
				<span class="battle-status-pill">FINISHED</span>
			`;
		}, 20);

		await expect(pollHydratedBattlePageMetadata(500, 10, 2)).resolves.toEqual({
			totalChallenges: 4,
			status: "finished",
		});
	});

	it("falls back to target tiles when play links are not available", async () => {
		document.body.innerHTML = `
			<section class="targets-container">
				<div class="target-tile">#1</div>
				<div class="target-tile">#2</div>
				<div class="target-tile">#3</div>
			</section>
			<span class="battle-status-pill">LIVE</span>
		`;

		await expect(pollHydratedBattlePageMetadata(100, 5, 1)).resolves.toEqual({
			totalChallenges: 3,
			status: "unfinished",
		});
	});

	it("returns null metadata when the battle data never hydrates", async () => {
		document.body.innerHTML = "Loading battle...";

		await expect(pollHydratedBattlePageMetadata(20, 5, 1)).resolves.toEqual({
			totalChallenges: null,
			status: null,
		});
	});
});
