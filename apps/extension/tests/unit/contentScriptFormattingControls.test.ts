// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/storage/authSession";

const defaultStoredState = {
	settings: {
		threshold: 95,
		selectedRepoFullName: null,
		selectedBranch: null,
		systemNotificationsEnabled: true,
		repositoryReadmeMode: "managed-section",
		pageFeedbackPlacement: "bottom-right",
		savedCodeFormat: "original",
		includePrettifiedCode: false,
		showFormattingControls: true,
	},
};

describe("contentScriptFormattingControls", () => {
	beforeEach(async () => {
		vi.resetModules();
		document.body.innerHTML = `
			<div class="container__item--editor">
				<div class="cm-editor"></div>
			</div>
		`;
		vi.stubGlobal("chrome", {
			storage: {
				local: {
					get: vi.fn().mockResolvedValue({
						[STORAGE_KEY]: defaultStoredState,
					}),
					set: vi.fn().mockResolvedValue(undefined),
				},
				session: {
					get: vi.fn().mockResolvedValue({}),
					set: vi.fn().mockResolvedValue(undefined),
					remove: vi.fn().mockResolvedValue(undefined),
				},
				onChanged: {
					addListener: vi.fn(),
				},
			},
			runtime: {
				sendMessage: vi.fn(),
			},
		});
	});

	const mountControls = async (): Promise<HTMLElement> => {
		const { initFormattingControls } = await import("@/contentScriptFormattingControls");
		initFormattingControls();
		document.dispatchEvent(new Event("DOMContentLoaded"));
		await Promise.resolve();
		await Promise.resolve();
		const controls = document.getElementById("csshub-formatting-controls");
		expect(controls).not.toBeNull();
		Object.defineProperty(controls!, "offsetWidth", { configurable: true, value: 240 });
		Object.defineProperty(controls!, "offsetHeight", { configurable: true, value: 110 });
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => resolve());
			});
		});
		return controls!;
	};

	it("mounts controls when enabled", async () => {
		const controls = await mountControls();
		expect(controls.hidden).toBe(false);
		expect(controls.textContent).toContain("Preview prettified");
		expect(controls.textContent).toContain("Preview minified");
	});

	it("hides controls when showFormattingControls is false", async () => {
		const getMock = chrome.storage.local.get as ReturnType<typeof vi.fn>;
		getMock.mockResolvedValueOnce({
			[STORAGE_KEY]: {
				settings: {
					...defaultStoredState.settings,
					showFormattingControls: false,
				},
			},
		});
		const controls = await mountControls();
		expect(controls.hidden).toBe(true);
	});

	it("restores a saved position on mount", async () => {
		const getMock = chrome.storage.local.get as ReturnType<typeof vi.fn>;
		getMock.mockResolvedValueOnce({
			[STORAGE_KEY]: {
				settings: {
					...defaultStoredState.settings,
					formattingControlsPosition: { leftPct: 0.145, topPct: 0.667 },
				},
			},
		});
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });

		const controls = await mountControls();
		vi.spyOn(controls, "getBoundingClientRect").mockReturnValue({
			x: 116,
			y: 400,
			left: 116,
			top: 400,
			right: 356,
			bottom: 510,
			width: 240,
			height: 110,
			toJSON: () => ({}),
		});

		expect(controls.style.left).toBe("116px");
		expect(controls.style.top).toBe("400px");
		expect(controls.style.bottom).toBe("auto");
	});

	it("lets the user drag the controls around the viewport", async () => {
		const controls = await mountControls();
		const handle = controls.querySelector(".csshub-formatting-header");
		expect(handle).not.toBeNull();

		Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
		vi.spyOn(controls, "getBoundingClientRect").mockReturnValue({
			x: 16,
			y: 480,
			left: 16,
			top: 480,
			right: 256,
			bottom: 590,
			width: 240,
			height: 110,
			toJSON: () => ({}),
		});

		handle!.dispatchEvent(
			new MouseEvent("pointerdown", {
				button: 0,
				clientX: 30,
				clientY: 500,
				bubbles: true,
			})
		);
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				clientX: 130,
				clientY: 420,
				bubbles: true,
			})
		);
		document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));

		expect(controls.style.left).toBe("116px");
		expect(controls.style.top).toBe("400px");
		expect(controls.style.bottom).toBe("auto");
		expect(controls.classList.contains("csshub-formatting-controls-dragging")).toBe(
			false
		);
		expect(document.body.style.cursor).toBe("");
	});

	it("persists the dragged position to storage", async () => {
		const setMock = chrome.storage.local.set as ReturnType<typeof vi.fn>;
		const getMock = chrome.storage.local.get as ReturnType<typeof vi.fn>;
		getMock.mockResolvedValueOnce({ [STORAGE_KEY]: undefined });
		const controls = await mountControls();
		const handle = controls.querySelector(".csshub-formatting-header");
		expect(handle).not.toBeNull();

		Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });
		vi.spyOn(controls, "getBoundingClientRect").mockReturnValue({
			x: 16,
			y: 480,
			left: 16,
			top: 480,
			right: 256,
			bottom: 590,
			width: 240,
			height: 110,
			toJSON: () => ({}),
		});

		handle!.dispatchEvent(
			new MouseEvent("pointerdown", {
				button: 0,
				clientX: 30,
				clientY: 500,
				bubbles: true,
			})
		);
		document.dispatchEvent(
			new MouseEvent("pointermove", {
				clientX: 130,
				clientY: 420,
				bubbles: true,
			})
		);
		document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
		await vi.waitFor(() => {
			expect(setMock).toHaveBeenCalled();
		});

		const savedState = setMock.mock.calls.at(-1)?.[0]?.[STORAGE_KEY] as {
			settings?: {
				formattingControlsPosition?: { leftPct: number; topPct: number };
				threshold?: number;
			};
		};
		expect(savedState.settings?.formattingControlsPosition).toEqual({
			leftPct: 0.145,
			topPct: 400 / 600,
		});
		expect(savedState.settings?.threshold).toBe(95);
	});

	it("restores position after reload when storage only had a partial settings object", async () => {
		const getMock = chrome.storage.local.get as ReturnType<typeof vi.fn>;
		getMock.mockResolvedValueOnce({
			[STORAGE_KEY]: {
				settings: {
					formattingControlsPosition: { leftPct: 0.145, topPct: 0.667 },
				},
			},
		});
		Object.defineProperty(window, "innerWidth", { configurable: true, value: 800 });
		Object.defineProperty(window, "innerHeight", { configurable: true, value: 600 });

		const controls = await mountControls();
		vi.spyOn(controls, "getBoundingClientRect").mockReturnValue({
			x: 116,
			y: 400,
			left: 116,
			top: 400,
			right: 356,
			bottom: 510,
			width: 240,
			height: 110,
			toJSON: () => ({}),
		});

		expect(controls.style.left).toBe("116px");
		expect(controls.style.top).toBe("400px");
		expect(controls.classList.contains("csshub-formatting-controls--default-position")).toBe(
			false
		);
	});

	it("shows grab cursor on the drag handle", async () => {
		const controls = await mountControls();
		const handle = controls.querySelector(".csshub-formatting-header") as HTMLElement | null;
		const label = handle?.querySelector(".csshub-formatting-label") as HTMLElement | null;

		expect(getComputedStyle(handle!).cursor).toBe("grab");
		expect(getComputedStyle(label!).cursor).toBe("grab");
		expect(getComputedStyle(controls.querySelector("button")!).cursor).toBe("pointer");
	});

	it("defers mount until document.body exists", async () => {
		document.body.remove();
		const { FORMATTING_CONTROLS_ID, initFormattingControls } = await import(
			"@/contentScriptFormattingControls"
		);
		initFormattingControls();
		expect(document.getElementById(FORMATTING_CONTROLS_ID)).toBeNull();
		document.body = document.createElement("body");
		document.dispatchEvent(new Event("DOMContentLoaded"));
		await vi.waitFor(() => {
			expect(document.getElementById(FORMATTING_CONTROLS_ID)).not.toBeNull();
		});
	});
});
