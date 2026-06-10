import { describe, expect, it } from "vitest";
import {
	BackgroundError,
	getBackgroundErrorMessage,
	isBackgroundResponse,
	parseBackgroundOk,
	parseBackgroundOkVoid,
} from "@/shared/messaging";
import { z } from "zod";

describe("isBackgroundResponse", () => {
	it("accepts ok responses with or without data", () => {
		expect(isBackgroundResponse({ ok: true })).toBe(true);
		expect(isBackgroundResponse({ ok: true, data: { x: 1 } })).toBe(true);
	});

	it("accepts error responses with a string error", () => {
		expect(isBackgroundResponse({ ok: false, error: "nope" })).toBe(true);
	});

	it("rejects malformed payloads", () => {
		expect(isBackgroundResponse(null)).toBe(false);
		expect(isBackgroundResponse({ ok: false })).toBe(false);
	});
});

describe("getBackgroundErrorMessage", () => {
	it("returns the background error when present", () => {
		expect(getBackgroundErrorMessage({ ok: false, error: "bad" }, "fallback")).toBe(
			"bad"
		);
	});

	it("returns fallback for missing or invalid responses", () => {
		expect(getBackgroundErrorMessage(undefined, "fallback")).toBe("fallback");
	});
});

describe("parseBackgroundOk", () => {
	const schema = z.object({ value: z.number() });

	it("parses successful data with schema", () => {
		expect(parseBackgroundOk({ ok: true, data: { value: 2 } }, schema, "fail")).toEqual(
			{ value: 2 }
		);
	});

	it("throws BackgroundError when response is not ok", () => {
		expect(() =>
			parseBackgroundOk({ ok: false, error: "denied" }, schema, "fail")
		).toThrow(BackgroundError);
	});

	it("throws when data does not match schema", () => {
		expect(() =>
			parseBackgroundOk({ ok: true, data: { value: "x" } }, schema, "fail")
		).toThrow(BackgroundError);
	});
});

describe("parseBackgroundOkVoid", () => {
	it("accepts ok responses without data", () => {
		expect(() => parseBackgroundOkVoid({ ok: true }, "fail")).not.toThrow();
	});

	it("throws when response is not ok", () => {
		expect(() => parseBackgroundOkVoid({ ok: false, error: "nope" }, "fail")).toThrow(
			BackgroundError
		);
	});
});
