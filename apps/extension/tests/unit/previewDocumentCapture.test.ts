// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
	capturePreviewFromDocument,
	isLikelyPreviewFrameDocument,
} from "@/previewDocumentCapture";

describe("isLikelyPreviewFrameDocument", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
	});

	it("rejects editor frames", () => {
		document.body.innerHTML = '<div class="cm-line">a{}</div>';
		expect(isLikelyPreviewFrameDocument(document)).toBe(false);
	});

	it("accepts small preview-sized documents", () => {
		document.body.innerHTML = '<canvas width="400" height="300"></canvas>';
		Object.defineProperty(document.documentElement, "clientWidth", {
			value: 400,
			configurable: true,
		});
		Object.defineProperty(document.documentElement, "clientHeight", {
			value: 300,
			configurable: true,
		});
		expect(isLikelyPreviewFrameDocument(document)).toBe(true);
	});
});

describe("capturePreviewFromDocument", () => {
	it("returns null when the document has no rasterizable nodes", () => {
		document.body.innerHTML = "<div>preview</div>";
		expect(capturePreviewFromDocument(document)).toBeNull();
	});
});
