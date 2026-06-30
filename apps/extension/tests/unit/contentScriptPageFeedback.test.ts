// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	computeEffectiveBottomOffset,
	EDGE_INSET_PX,
	FEEDBACK_EXIT_MS,
	findVisibleCssBattleToast,
	hidePageFeedbackPrompt,
	PROMPT_ELEMENT_ID,
	resetPageFeedbackStateForTests,
	setPageFeedbackPlacement,
	showCaptureFailurePrompt,
	showPageFeedbackPrompt,
	showProcessingPrompt,
	showSubmissionErrorPrompt,
	showSubmissionOutcomePrompt,
} from "@/contentScriptPageFeedback";

const finishExitAnimation = async (): Promise<void> => {
	await vi.advanceTimersByTimeAsync(FEEDBACK_EXIT_MS + 40);
};

describe("contentScriptPageFeedback", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		document.body.innerHTML = "";
		resetPageFeedbackStateForTests();
	});

	afterEach(() => {
		resetPageFeedbackStateForTests();
		vi.useRealTimers();
	});

	it("renders a concise capture failure prompt with guidance", () => {
		showCaptureFailurePrompt(["preview-image", "last-score"]);

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt).not.toBeNull();
		expect(prompt?.dataset.tone).toBe("warn");
		expect(prompt?.textContent).toContain("Capture failed");
		expect(prompt?.textContent).toContain("Missing preview image, Last score");
		expect(prompt?.textContent).toContain("Submit again once the page finishes updating.");
		expect(prompt?.textContent).toContain("Disable extensions that modify CSSBattle");
		expect(prompt?.textContent).not.toContain("Could not capture submission");
	});

	it("renders the prompt as a compact status panel with a structured body", () => {
		showCaptureFailurePrompt(["editor-code"]);

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.style.background).toContain("rgba");
		expect(prompt?.style.border).toContain("solid");
		expect(prompt?.querySelector('[data-csshub-feedback-body="true"]')).not.toBeNull();
		expect(prompt?.querySelector('[data-csshub-feedback-accent="true"]')).not.toBeNull();
	});

	it("updates the same element on repeated prompts", () => {
		showCaptureFailurePrompt(["editor-code"]);
		showCaptureFailurePrompt(["target-image"]);

		expect(document.querySelectorAll(`#${PROMPT_ELEMENT_ID}`)).toHaveLength(1);
		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain(
			"Missing target image"
		);
	});

	it("dismiss hides the in-page prompt after an exit animation", async () => {
		showCaptureFailurePrompt(["editor-code"]);
		const dismiss = document.getElementById(PROMPT_ELEMENT_ID)?.querySelector("button");
		expect(dismiss?.dataset.csshubFeedbackControl).toBe("dismiss");
		dismiss?.click();

		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();
		await finishExitAnimation();
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("hidePageFeedbackPrompt removes the element after an exit animation", async () => {
		showCaptureFailurePrompt(["editor-code"]);
		hidePageFeedbackPrompt();
		await finishExitAnimation();
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("shows a processing prompt without a dismiss button", () => {
		showProcessingPrompt();

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.textContent).toContain("Processing submission");
		expect(prompt?.querySelector("button")).toBeNull();
	});

	it("shows a spinner instead of ellipsis for processing", () => {
		showProcessingPrompt();

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.querySelector('[data-csshub-feedback-spinner="true"]')).not.toBeNull();
		expect(prompt?.textContent).not.toContain("…");
		expect(prompt?.textContent).not.toContain("...");
	});

	it("shows success with a commit link and auto-hides after six seconds", async () => {
		showSubmissionOutcomePrompt({
			accepted: true,
			threshold: 95,
			reason: "Submission committed to GitHub.",
			code: "SYNC_COMMITTED",
			committed: true,
			commitUrl: "https://github.com/o/r/commit/abc",
		});

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.textContent).toContain("Synced to GitHub");
		expect(prompt?.style.getPropertyValue("--csshub-feedback-accent")).toBe("#16a34a");
		const link = prompt?.querySelector("a");
		expect(link?.textContent).toBe("View commit on GitHub");
		expect(link?.getAttribute("href")).toBe("https://github.com/o/r/commit/abc");
		expect(link?.style.borderRadius).toBe("999px");
		expect(link?.dataset.csshubFeedbackControl).toBe("action");

		vi.advanceTimersByTime(5_999);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();

		vi.advanceTimersByTime(1);
		await finishExitAnimation();
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("shows warn outcomes and auto-hides after ten seconds", async () => {
		showSubmissionOutcomePrompt({
			accepted: false,
			threshold: 95,
			reason: "Below threshold.",
			code: "SYNC_SKIPPED_THRESHOLD",
			committed: false,
			commitUrl: null,
		});

		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain(
			"Submission skipped"
		);

		vi.advanceTimersByTime(10_000);
		await finishExitAnimation();
		expect(document.getElementById(PROMPT_ELEMENT_ID)).toBeNull();
	});

	it("keeps error prompts visible until dismissed", () => {
		showSubmissionErrorPrompt("GitHub unavailable");

		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain("Sync failed");

		vi.advanceTimersByTime(30_000);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();
	});

	it("does not auto-hide capture failure prompts", () => {
		showCaptureFailurePrompt(["preview-image"]);

		vi.advanceTimersByTime(30_000);
		expect(document.getElementById(PROMPT_ELEMENT_ID)).not.toBeNull();
	});

	it("replaces processing with the final outcome prompt", () => {
		showProcessingPrompt();
		showPageFeedbackPrompt({
			tone: "success",
			title: "Synced to GitHub",
			detail: "Done",
			autoHideMs: 6_000,
		});

		expect(document.querySelectorAll(`#${PROMPT_ELEMENT_ID}`)).toHaveLength(1);
		expect(document.getElementById(PROMPT_ELEMENT_ID)?.textContent).toContain(
			"Synced to GitHub"
		);
	});

	it("injects page feedback keyframes with a reduced-motion fallback once", () => {
		showProcessingPrompt();
		showCaptureFailurePrompt(["target-image"]);

		const style = document.getElementById("csshub-page-feedback-styles");
		expect(style).not.toBeNull();
		expect(style?.textContent).toContain("@keyframes csshub-feedback-enter-from-bottom");
		expect(style?.textContent).toContain("@keyframes csshub-feedback-exit-to-bottom");
		expect(style?.textContent).toContain("@keyframes csshub-feedback-update");
		expect(style?.textContent).toContain("prefers-reduced-motion:reduce");
		expect(document.querySelectorAll("#csshub-page-feedback-styles")).toHaveLength(1);
	});

	it("plays an enter animation on first show and an update animation on content swap", () => {
		showProcessingPrompt();
		const prompt = document.getElementById(PROMPT_ELEMENT_ID) as HTMLDivElement;
		expect(prompt.dataset.csshubFeedbackPhase).toBe("enter");
		expect(prompt.style.animation).toContain("csshub-feedback-enter-from-bottom");

		showPageFeedbackPrompt({
			tone: "success",
			title: "Synced to GitHub",
			detail: "Done",
			autoHideMs: 6_000,
		});
		expect(prompt.dataset.csshubFeedbackPhase).toBe("update");
		expect(prompt.style.animation).toContain("csshub-feedback-update");
	});

	it("applies each corner placement to the prompt", () => {
		showProcessingPrompt();
		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt).not.toBeNull();

		setPageFeedbackPlacement("top-left");
		expect(prompt?.style.top).toBe(`${EDGE_INSET_PX}px`);
		expect(prompt?.style.left).toBe(`${EDGE_INSET_PX}px`);
		expect(prompt?.style.bottom).toBe("auto");
		expect(prompt?.style.right).toBe("auto");

		setPageFeedbackPlacement("top-right");
		expect(prompt?.style.top).toBe(`${EDGE_INSET_PX}px`);
		expect(prompt?.style.right).toBe(`${EDGE_INSET_PX}px`);

		setPageFeedbackPlacement("bottom-left");
		expect(prompt?.style.bottom).toBe(`${EDGE_INSET_PX}px`);
		expect(prompt?.style.left).toBe(`${EDGE_INSET_PX}px`);

		setPageFeedbackPlacement("bottom-right");
		expect(prompt?.style.bottom).toBe(`${EDGE_INSET_PX}px`);
		expect(prompt?.style.right).toBe(`${EDGE_INSET_PX}px`);
	});

	it("offsets bottom-right Page Feedback above a visible CSSBattle toast", () => {
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 900,
		});

		const toastify = document.createElement("div");
		toastify.className = "Toastify";
		const toast = document.createElement("div");
		toast.className = "Toastify__toast";
		toastify.append(toast);
		document.body.append(toastify);

		vi.spyOn(toast, "getBoundingClientRect").mockReturnValue({
			x: 700,
			y: 760,
			top: 760,
			left: 700,
			right: 980,
			bottom: 860,
			width: 280,
			height: 100,
			toJSON: () => ({}),
		});

		expect(findVisibleCssBattleToast()).toBe(toast);
		expect(computeEffectiveBottomOffset("bottom-right")).toBe(152);

		setPageFeedbackPlacement("bottom-right");
		showProcessingPrompt();

		const prompt = document.getElementById(PROMPT_ELEMENT_ID);
		expect(prompt?.style.bottom).toBe("152px");
	});

	it("returns Page Feedback to the base bottom offset when CSSBattle toast disappears", async () => {
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 900,
		});

		const toastify = document.createElement("div");
		toastify.className = "Toastify";
		const toast = document.createElement("div");
		toast.className = "Toastify__toast";
		toastify.append(toast);
		document.body.append(toastify);

		const rectSpy = vi.spyOn(toast, "getBoundingClientRect").mockReturnValue({
			x: 700,
			y: 760,
			top: 760,
			left: 700,
			right: 980,
			bottom: 860,
			width: 280,
			height: 100,
			toJSON: () => ({}),
		});

		setPageFeedbackPlacement("bottom-right");
		showProcessingPrompt();
		const prompt = document.getElementById(PROMPT_ELEMENT_ID) as HTMLDivElement;

		expect(prompt.style.bottom).toBe("152px");

		toast.remove();
		rectSpy.mockRestore();
		await Promise.resolve();

		expect(computeEffectiveBottomOffset("bottom-right")).toBe(EDGE_INSET_PX);
		expect(prompt.style.bottom).toBe(`${EDGE_INSET_PX}px`);
	});

	it("returns Page Feedback to the base bottom offset when CSSBattle removes its toast container", async () => {
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 900,
		});

		const toastify = document.createElement("div");
		toastify.className = "Toastify";
		const toast = document.createElement("div");
		toast.className = "Toastify__toast";
		toastify.append(toast);
		document.body.append(toastify);

		vi.spyOn(toast, "getBoundingClientRect").mockReturnValue({
			x: 700,
			y: 760,
			top: 760,
			left: 700,
			right: 980,
			bottom: 860,
			width: 280,
			height: 100,
			toJSON: () => ({}),
		});

		setPageFeedbackPlacement("bottom-right");
		showProcessingPrompt();
		const prompt = document.getElementById(PROMPT_ELEMENT_ID) as HTMLDivElement;
		expect(prompt.style.bottom).toBe("152px");

		toastify.remove();
		await Promise.resolve();

		expect(prompt.style.bottom).toBe(`${EDGE_INSET_PX}px`);
	});

	it("returns Page Feedback to the base bottom offset when CSSBattle keeps an empty toast container", async () => {
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 900,
		});

		const toastify = document.createElement("div");
		toastify.className = "Toastify";
		const toast = document.createElement("div");
		toast.className = "Toastify__toast";
		toastify.append(toast);
		document.body.append(toastify);

		vi.spyOn(toast, "getBoundingClientRect").mockReturnValue({
			x: 700,
			y: 760,
			top: 760,
			left: 700,
			right: 980,
			bottom: 860,
			width: 280,
			height: 100,
			toJSON: () => ({}),
		});

		setPageFeedbackPlacement("bottom-right");
		showProcessingPrompt();
		const prompt = document.getElementById(PROMPT_ELEMENT_ID) as HTMLDivElement;
		expect(prompt.style.bottom).toBe("152px");

		toast.remove();
		await Promise.resolve();

		expect(toastify.childElementCount).toBe(0);
		expect(prompt.style.bottom).toBe(`${EDGE_INSET_PX}px`);
	});

	it("keeps bottom-right avoidance active when bottom-right is already selected", async () => {
		Object.defineProperty(window, "innerHeight", {
			configurable: true,
			value: 900,
		});

		setPageFeedbackPlacement("bottom-right");
		showProcessingPrompt();
		const prompt = document.getElementById(PROMPT_ELEMENT_ID) as HTMLDivElement;
		expect(prompt.style.bottom).toBe(`${EDGE_INSET_PX}px`);

		const toastify = document.createElement("div");
		toastify.className = "Toastify";
		const toast = document.createElement("div");
		toast.className = "Toastify__toast";
		vi.spyOn(toast, "getBoundingClientRect").mockReturnValue({
			x: 700,
			y: 760,
			top: 760,
			left: 700,
			right: 980,
			bottom: 860,
			width: 280,
			height: 100,
			toJSON: () => ({}),
		});

		toastify.append(toast);
		document.body.append(toastify);
		await Promise.resolve();

		expect(prompt.style.bottom).toBe("152px");
	});
});
