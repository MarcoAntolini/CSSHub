// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormattingControlsPosition } from "@/shared/contracts";
import { EXTENSION_THEME_STORAGE_KEY } from "@/shared/extensionTheme";
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
		formattingControlsPosition: null as FormattingControlsPosition | null,
	},
};

type StoredStateOverride = {
	settings?: Partial<(typeof defaultStoredState)["settings"]> & Record<string, unknown>;
};

const supportedTargetBreadcrumbs = `
	<div class="Header-module__4HehcG__breadcrumbs">
		<a href="/battles">Battles</a>
		<a href="/battles/39">Battle #39</a>
		<button type="button">#254. Unfitting</button>
	</div>
`;

const buildStorageGetMock = (
	settingsState: StoredStateOverride = defaultStoredState
): ReturnType<typeof vi.fn> =>
	vi.fn().mockImplementation((keys: string | string[] | Record<string, unknown>) => {
		const keyList = Array.isArray(keys) ? keys : [keys];
		if (
			keyList.includes(EXTENSION_THEME_STORAGE_KEY) ||
			keyList.includes("csshub_popup_theme_v1")
		) {
			return Promise.resolve({ [EXTENSION_THEME_STORAGE_KEY]: "dark" });
		}
		if (keyList.includes(STORAGE_KEY)) {
			return Promise.resolve({ [STORAGE_KEY]: settingsState });
		}
		return Promise.resolve({});
	});

describe("contentScriptFormattingControls", () => {
	beforeEach(async () => {
		vi.resetModules();
		document.body.innerHTML = `
			${supportedTargetBreadcrumbs}
			<div class="container__item--editor">
				<div class="cm-editor"></div>
			</div>
		`;
		vi.stubGlobal("chrome", {
			storage: {
				local: {
					get: buildStorageGetMock(),
					set: vi.fn().mockResolvedValue(undefined),
				},
				session: {
					get: vi.fn().mockResolvedValue({}),
					set: vi.fn().mockResolvedValue(undefined),
					remove: vi.fn().mockResolvedValue(undefined),
				},
				onChanged: {
					addListener: vi.fn(),
					removeListener: vi.fn(),
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
		(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
			buildStorageGetMock({
				settings: {
					...defaultStoredState.settings,
					showFormattingControls: false,
				},
			})
		);
		const controls = await mountControls();
		expect(controls.hidden).toBe(true);
	});

	it("hides controls on unsupported target routes", async () => {
		document.body.innerHTML = `
			<div class="Header-module__4HehcG__breadcrumbs">
				<a href="/versus">Versus</a>
				<button type="button">Room 1</button>
			</div>
			<div class="container__item--editor">
				<div class="cm-editor"></div>
			</div>
		`;
		const controls = await mountControls();
		expect(controls.hidden).toBe(true);
	});

	it("shows controls once breadcrumbs identify a supported target route", async () => {
		document.body.innerHTML = `
			<div class="container__item--editor">
				<div class="cm-editor"></div>
			</div>
		`;
		const controls = await mountControls();
		expect(controls.hidden).toBe(true);

		document.body.insertAdjacentHTML(
			"afterbegin",
			supportedTargetBreadcrumbs
		);
		await vi.waitFor(() => {
			expect(controls.hidden).toBe(false);
		});
	});

	it("restores a saved position on mount", async () => {
		(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
			buildStorageGetMock({
				settings: {
					...defaultStoredState.settings,
					formattingControlsPosition: { leftPct: 0.145, topPct: 0.667 },
				},
			})
		);
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
		(chrome.storage.local.get as ReturnType<typeof vi.fn>).mockImplementation(
			buildStorageGetMock({
				settings: {
					formattingControlsPosition: { leftPct: 0.145, topPct: 0.667 },
				},
			})
		);
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

	const getPreviewShadow = (): ShadowRoot => {
		const host = document.getElementById("csshub-formatting-preview");
		expect(host).not.toBeNull();
		expect(host!.shadowRoot).not.toBeNull();
		return host!.shadowRoot!;
	};

	it("shows an apply button in the prettified preview", async () => {
		const sendMessageMock = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
		sendMessageMock.mockImplementation(async (message: { action: string }) => {
			if (message.action === "extractCssbattleEditorCode") {
				return { ok: true, data: { code: "body{margin:0}" } };
			}
			if (message.action === "formatCssbattleEditorCode") {
				return { ok: true, data: { code: "body {\n  margin: 0;\n}" } };
			}
			return { ok: false };
		});

		const controls = await mountControls();
		const previewButton = Array.from(controls.querySelectorAll("button")).find(
			(button) => button.textContent === "Preview prettified"
		);
		expect(previewButton).toBeTruthy();
		previewButton!.click();
		await vi.waitFor(() => {
			expect(document.getElementById("csshub-formatting-preview")).not.toBeNull();
		});

		const shadow = getPreviewShadow();
		const applyButton = shadow.querySelector(".csshub-formatting-preview-apply");
		expect(applyButton?.textContent).toBe("Apply prettified");
	});

	it("applies previewed code from the preview without re-formatting", async () => {
		const formattedCode = "body {\n  margin: 0;\n}";
		const sendMessageMock = chrome.runtime.sendMessage as ReturnType<typeof vi.fn>;
		sendMessageMock.mockImplementation(async (message: { action: string; code?: string }) => {
			if (message.action === "extractCssbattleEditorCode") {
				return { ok: true, data: { code: "body{margin:0}" } };
			}
			if (message.action === "formatCssbattleEditorCode") {
				return { ok: true, data: { code: formattedCode } };
			}
			if (message.action === "applyCssbattleEditorCode") {
				return { ok: true };
			}
			return { ok: false };
		});

		const controls = await mountControls();
		const previewButton = Array.from(controls.querySelectorAll("button")).find(
			(button) => button.textContent === "Preview minified"
		);
		previewButton!.click();
		await vi.waitFor(() => {
			expect(document.getElementById("csshub-formatting-preview")).not.toBeNull();
		});

		const shadow = getPreviewShadow();
		const applyButton = shadow.querySelector(
			".csshub-formatting-preview-apply"
		) as HTMLButtonElement;
		expect(applyButton.textContent).toBe("Apply minified");
		applyButton.click();
		await vi.waitFor(() => {
			expect(document.getElementById("csshub-formatting-preview")).toBeNull();
		});

		const applyCalls = sendMessageMock.mock.calls.filter(
			([message]) => message.action === "applyCssbattleEditorCode"
		);
		expect(applyCalls).toHaveLength(1);
		expect(applyCalls[0]?.[0]).toEqual({
			action: "applyCssbattleEditorCode",
			code: formattedCode,
		});
		const formatCallsAfterPreview = sendMessageMock.mock.calls.filter(
			([message]) => message.action === "formatCssbattleEditorCode"
		);
		expect(formatCallsAfterPreview).toHaveLength(1);
	});
});
