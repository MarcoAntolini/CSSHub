// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import {
	CLICKABLE_SELECTOR,
	extractCodeFromCmLines,
	findTargetImage,
	getChallengeIdFromPathname,
	getChallengeNameFromTitle,
	getElementDimensions,
	isSubmitControlText,
	isTargetImageElement,
	PREVIEW_SELECTOR,
} from "../../src/contentScriptDom";

const FIXTURE_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	"../fixtures/cssbattle-play-minimal.html"
);

describe("getChallengeIdFromPathname", () => {
	it("extracts numeric id from play URL", () => {
		expect(getChallengeIdFromPathname("/play/42")).toBe("42");
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

const loadFixture = (): void => {
	const parsed = new DOMParser().parseFromString(
		readFileSync(FIXTURE_PATH, "utf8"),
		"text/html"
	);
	document.head.innerHTML = parsed.head.innerHTML;
	document.body.innerHTML = parsed.body.innerHTML;
	document.title = parsed.title;
};

describe("fixture DOM helpers", () => {
	beforeEach(() => {
		loadFixture();
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

	it("finds target image by alt and src", () => {
		const img = document.querySelector("img");
		expect(img).toBeInstanceOf(HTMLImageElement);
		expect(isTargetImageElement(img as HTMLImageElement)).toBe(true);
		const target = findTargetImage(document);
		expect(target?.type).toBe("url");
		expect(target?.value).toContain("/targets/42.png");
	});

	it("reads challenge metadata from fixture head", () => {
		expect(getChallengeIdFromPathname("/play/42")).toBe("42");
		expect(getChallengeNameFromTitle(document.title, "42")).toBe("Carrom");
	});

	it("returns element dimensions when layout is non-zero", () => {
		const iframe = document.querySelector("iframe");
		expect(iframe).not.toBeNull();
		iframe!.getBoundingClientRect = () =>
			new DOMRect(10, 20, 300, 200);

		const dims = getElementDimensions(document, PREVIEW_SELECTOR, 2);
		expect(dims).toEqual({ x: 20, y: 40, width: 600, height: 400 });
	});
});
