// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
	buildCanonicalDailyTargetUrl,
	CLICKABLE_SELECTOR,
	asImageDataUrlOrNull,
	extractCodeFromCmLines,
	findOgTargetImageUrl,
	findPreviewIframe,
	findTargetImage,
	getChallengeIdFromPathname,
	getChallengeNameFromTitle,
	getElementDimensions,
	getElementDimensionsFromElement,
	getTargetImageUrl,
	isCssBattleHostedTargetUrl,
	isFooterDecorativeImage,
	isSubmitControlText,
	isTargetImageElement,
	PREVIEW_SELECTOR,
	scoreTargetImageCandidate,
} from "../../src/contentScriptDom";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");

const loadFixture = (name: string): void => {
	const parsed = new DOMParser().parseFromString(
		readFileSync(join(FIXTURE_DIR, name), "utf8"),
		"text/html"
	);
	document.head.innerHTML = parsed.head.innerHTML;
	document.body.innerHTML = parsed.body.innerHTML;
	document.title = parsed.title;
};

describe("getChallengeIdFromPathname", () => {
	it("extracts numeric id from play URL", () => {
		expect(getChallengeIdFromPathname("/play/42")).toBe("42");
	});

	it("extracts opaque id from daily play URL", () => {
		expect(getChallengeIdFromPathname("/play/17Bc6kIuAsiQgqP65moB")).toBe(
			"17Bc6kIuAsiQgqP65moB"
		);
	});

	it("returns unknown for non-play paths", () => {
		expect(getChallengeIdFromPathname("/leaderboard")).toBe("unknown");
	});
});

describe("getChallengeNameFromTitle", () => {
	it("parses target name from document title", () => {
		expect(getChallengeNameFromTitle("Target #42: Carrom", "42")).toBe("Carrom");
	});

	it("falls back to Target-{id}", () => {
		expect(getChallengeNameFromTitle("CSSBattle", "7")).toBe("Target-7");
	});
});

describe("isSubmitControlText", () => {
	it("matches submit labels case-insensitively", () => {
		expect(isSubmitControlText("Submit")).toBe(true);
		expect(isSubmitControlText("SUBMIT SCORE")).toBe(true);
		expect(isSubmitControlText("Save")).toBe(false);
	});
});

describe("asImageDataUrlOrNull", () => {
	it("keeps image data URLs and drops empty canvas placeholders", () => {
		expect(asImageDataUrlOrNull("data:image/png;base64,abc")).toBe(
			"data:image/png;base64,abc"
		);
		expect(asImageDataUrlOrNull("data:,")).toBeNull();
	});
});

describe("fixture DOM helpers (minimal)", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-minimal.html");
	});

	it("finds preview iframe via PREVIEW_SELECTOR", () => {
		expect(document.querySelector(PREVIEW_SELECTOR)).not.toBeNull();
	});

	it("detects submit button via CLICKABLE_SELECTOR", () => {
		const button = document.querySelector(CLICKABLE_SELECTOR);
		expect(button?.textContent?.trim()).toBe("Submit");
		expect(isSubmitControlText(button?.textContent ?? "")).toBe(true);
	});

	it("extracts CodeMirror lines", () => {
		expect(extractCodeFromCmLines(document)).toBe("body{\nmargin:0;");
	});

	it("falls back to Monaco view-line markup", () => {
		document.body.innerHTML = `
			<div class="monaco-editor">
				<div class="view-line">body{</div>
				<div class="view-line">margin:0;</div>
			</div>
		`;
		expect(extractCodeFromCmLines(document)).toBe("body{\nmargin:0;");
	});

	it("finds target image by alt and src", () => {
		const img = document.querySelector("img");
		expect(img).toBeInstanceOf(HTMLImageElement);
		expect(isTargetImageElement(img as HTMLImageElement)).toBe(true);
		const target = findTargetImage(
			document,
			"https://cssbattle.dev/play/42",
			"42"
		);
		expect(target?.type).toBe("url");
		expect(target?.value).toBe("https://cssbattle.dev/targets/42.png");
	});

	it("reads challenge metadata from fixture head", () => {
		expect(getChallengeIdFromPathname("/play/42")).toBe("42");
		expect(getChallengeNameFromTitle(document.title, "42")).toBe("Carrom");
	});

	it("returns element dimensions when layout is non-zero", () => {
		const iframe = document.querySelector("iframe");
		expect(iframe).not.toBeNull();
		iframe!.getBoundingClientRect = () => new DOMRect(10, 20, 300, 200);

		const dims = getElementDimensions(document, PREVIEW_SELECTOR, 2);
		expect(dims).toEqual({ x: 20, y: 40, width: 600, height: 400 });
	});
});

describe("current CSSBattle markup", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-current.html");
	});

	it("prefers /targets/ asset over decoy images with target in class", () => {
		const imgs = Array.from(document.querySelectorAll("img"));
		const levelTarget = imgs.find((img) =>
			img.classList.contains("levelpage__target")
		) as HTMLImageElement;
		const avatar = imgs.find((img) => img.classList.contains("avatar-target-badge")) as HTMLImageElement;

		expect(scoreTargetImageCandidate(levelTarget)).toBeGreaterThan(
			scoreTargetImageCandidate(avatar)
		);

		const target = findTargetImage(
			document,
			"https://cssbattle.dev/play/254",
			"254"
		);
		expect(target?.value).toBe("https://cssbattle.dev/targets/254.png");
	});

	it("finds preview iframe by class and exact title", () => {
		const iframe = findPreviewIframe(document);
		expect(iframe).not.toBeNull();
		expect(iframe?.classList.contains("preview-iframe")).toBe(true);
		expect(iframe?.title).toBe("Preview");
	});

	it("resolves absolute target URLs from empty alt + srcset", () => {
		const img = document.querySelector(".levelpage__target") as HTMLImageElement;
		expect(getTargetImageUrl(img, "https://cssbattle.dev/play/254")).toContain(
			"/targets/254"
		);
	});

	it("measures preview iframe dimensions directly", () => {
		const iframe = findPreviewIframe(document)!;
		iframe.getBoundingClientRect = () => new DOMRect(0, 0, 400, 300);
		expect(getElementDimensionsFromElement(iframe, 1)).toEqual({
			x: 0,
			y: 0,
			width: 400,
			height: 300,
		});
	});
});

describe("multiple /targets/ images on page", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-multi-targets.html");
	});

	it("picks the target matching the play URL challenge id, not larger sidebar thumbs", () => {
		const target = findTargetImage(
			document,
			"https://cssbattle.dev/play/254",
			"254"
		);
		expect(target?.value).toBe("https://cssbattle.dev/targets/254.png");
	});

	it("uses canonical target URL when levelpage img is stale from SPA navigation", () => {
		const stale = document.querySelector(".levelpage__target") as HTMLImageElement;
		stale.setAttribute("src", "/targets/14.png");

		const target = findTargetImage(
			document,
			"https://cssbattle.dev/play/254",
			"254"
		);
		expect(target?.value).toBe("https://cssbattle.dev/targets/254.png");
	});
});

describe("daily fixture target resolution", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-daily.html");
	});

	it("prefers canonical ImageKit URL over generic daily.png placeholder", () => {
		const challengeId = "17Bc6kIuAsiQgqP65moB";
		const target = findTargetImage(
			document,
			`https://cssbattle.dev/play/${challengeId}`,
			challengeId
		);
		expect(target?.value).toBe(
			`https://ik.imagekit.io/cssbattle/og/target?id=${challengeId}`
		);
	});
});

describe("daily target resolution", () => {
	beforeEach(() => {
		loadFixture("cssbattle-play-daily-og.html");
	});

	it("reads og:image when the target pane has not hydrated yet", () => {
		expect(findOgTargetImageUrl(document, "d88s7WXm7RoYXGfDKQ4P")).toBe(
			"https://ik.imagekit.io/cssbattle/og/target?id=d88s7WXm7RoYXGfDKQ4P"
		);
		const target = findTargetImage(
			document,
			"https://cssbattle.dev/play/d88s7WXm7RoYXGfDKQ4P",
			"d88s7WXm7RoYXGfDKQ4P"
		);
		expect(target?.value).toContain("d88s7WXm7RoYXGfDKQ4P");
	});

	it("ignores footer decorative targets", () => {
		const footerImg = document.querySelector(".footer__deco img") as HTMLImageElement;
		expect(isFooterDecorativeImage(footerImg)).toBe(true);
		expect(scoreTargetImageCandidate(footerImg, "d88s7WXm7RoYXGfDKQ4P")).toBeLessThan(0);
	});

	it("builds canonical ImageKit URL for opaque ids", () => {
		expect(buildCanonicalDailyTargetUrl("d88s7WXm7RoYXGfDKQ4P")).toBe(
			"https://ik.imagekit.io/cssbattle/og/target?id=d88s7WXm7RoYXGfDKQ4P"
		);
		expect(buildCanonicalDailyTargetUrl("254")).toBeNull();
	});

	it("recognizes Firebase Storage target URLs", () => {
		const firebaseUrl =
			"https://firebasestorage.googleapis.com/v0/b/cssbattleapp.appspot.com/o/user%2Fu1%2Ftargets%2Ftarget_0Bzoyf3.png?alt=media";
		expect(isCssBattleHostedTargetUrl(firebaseUrl)).toBe(true);
	});
});
