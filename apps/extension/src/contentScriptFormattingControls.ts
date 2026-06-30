import type {
	EditorCodeFormat,
	ExtensionSettings,
	FormattingControlsPosition,
} from "./shared/contracts";
import { readCssbattleEditorCode } from "./contentScriptEditorCode";
import { formatPreviewShadowStyles } from "./cssbattleEditorTheme";
import { highlightFormatPreviewCode } from "./formatPreviewHighlight";
import { parseStoredSettings } from "./storage/settingsMigration";
import { STORAGE_KEY } from "./storage/authSession";

export const FORMATTING_CONTROLS_ID = "csshub-formatting-controls";
const FORMATTING_CONTROLS_DEFAULT_POSITION_CLASS =
	"csshub-formatting-controls--default-position";
const FORMATTING_PREVIEW_ID = "csshub-formatting-preview";
const FORMATTING_STYLE_ID = "csshub-formatting-controls-styles";

let controlsVisible = true;
let controlsInitialized = false;
let storedControlsPosition: FormattingControlsPosition | null = null;
let resizeListenerAttached = false;

const POSITION_MARGIN = 8;

type DragState = {
	offsetX: number;
	offsetY: number;
	width: number;
	height: number;
};

let activeDrag: DragState | null = null;

const showFormattingControlsFromSettings = (settings: unknown): boolean => {
	return parseStoredSettings(settings).showFormattingControls !== false;
};

const readRawFormattingControlsPosition = (
	settings: unknown
): FormattingControlsPosition | null => {
	if (!settings || typeof settings !== "object") {
		return null;
	}
	const value = (settings as { formattingControlsPosition?: unknown })
		.formattingControlsPosition;
	if (!value || typeof value !== "object") {
		return null;
	}
	const { leftPct, topPct } = value as { leftPct?: unknown; topPct?: unknown };
	if (typeof leftPct !== "number" || typeof topPct !== "number") {
		return null;
	}
	if (leftPct < 0 || leftPct > 1 || topPct < 0 || topPct > 1) {
		return null;
	}
	return { leftPct, topPct };
};

const formattingControlsPositionFromSettings = (
	settings: unknown
): FormattingControlsPosition | null => {
	return (
		parseStoredSettings(settings).formattingControlsPosition ??
		readRawFormattingControlsPosition(settings)
	);
};

const applySettingsFromStorage = (settings: unknown | undefined): void => {
	controlsVisible = showFormattingControlsFromSettings(settings);
	storedControlsPosition = formattingControlsPositionFromSettings(settings);
	updateControlsVisibility();
	applyStoredControlsPosition();
};

const loadFormattingControlsSettings = async (): Promise<void> => {
	try {
		const stored = await chrome.storage.local.get(STORAGE_KEY);
		const state = stored[STORAGE_KEY] as { settings?: unknown } | undefined;
		applySettingsFromStorage(state?.settings);
	} catch (_error) {
		controlsVisible = true;
		storedControlsPosition = null;
	}
};

const patchStoredSettings = async (
	patch: (settings: ExtensionSettings) => Partial<ExtensionSettings>
): Promise<void> => {
	const stored = await chrome.storage.local.get(STORAGE_KEY);
	const current = (stored[STORAGE_KEY] ?? {}) as Record<string, unknown>;
	const parsedSettings = parseStoredSettings(current.settings);

	await chrome.storage.local.set({
		[STORAGE_KEY]: {
			...current,
			settings: {
				...parsedSettings,
				...patch(parsedSettings),
			},
		},
	});
};

const updateControlsVisibility = (): void => {
	const root = document.getElementById(FORMATTING_CONTROLS_ID);
	if (!root) {
		return;
	}
	root.hidden = !controlsVisible;
};

const extractEditorCode = async (): Promise<string | null> => {
	const code = await readCssbattleEditorCode();
	return code || null;
};

const formatEditorCodeRemote = async (
	code: string,
	format: EditorCodeFormat
): Promise<string> => {
	const response = (await chrome.runtime.sendMessage({
		action: "formatCssbattleEditorCode",
		format,
		code,
	})) as { ok?: boolean; data?: { code?: string }; error?: string };
	if (!response?.ok || typeof response.data?.code !== "string") {
		throw new Error(response?.error ?? "Formatting failed");
	}
	return response.data.code;
};

const applyEditorCodeRemote = async (code: string): Promise<void> => {
	const response = (await chrome.runtime.sendMessage({
		action: "applyCssbattleEditorCode",
		code,
	})) as { ok?: boolean; error?: string };
	if (!response?.ok) {
		throw new Error(response?.error ?? "Could not apply formatted code");
	}
};

const hidePreview = (): void => {
	document.getElementById(FORMATTING_PREVIEW_ID)?.remove();
};

const previewApplyLabel = (format: EditorCodeFormat): string => {
	return format === "prettified" ? "Apply prettified" : "Apply minified";
};

const applyPreviewedCode = async (code: string): Promise<void> => {
	try {
		await applyEditorCodeRemote(code);
		hidePreview();
	} catch (error) {
		const message = error instanceof Error ? error.message : "Formatting failed";
		window.alert(`CssHub formatting failed: ${message}`);
	}
};

const showPreview = (title: string, code: string, format: EditorCodeFormat): void => {
	hidePreview();

	const host = document.createElement("div");
	host.id = FORMATTING_PREVIEW_ID;

	const shadow = host.attachShadow({ mode: "open" });

	const style = document.createElement("style");
	style.textContent = formatPreviewShadowStyles;

	const overlay = document.createElement("div");
	overlay.className = "csshub-formatting-preview-overlay";
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-label", title);

	const panel = document.createElement("div");
	panel.className = "csshub-formatting-preview-panel";

	const header = document.createElement("div");
	header.className = "csshub-formatting-preview-header";

	const heading = document.createElement("p");
	heading.className = "csshub-formatting-preview-title";
	heading.textContent = title;

	const actions = document.createElement("div");
	actions.className = "csshub-formatting-preview-actions";

	const applyButton = document.createElement("button");
	applyButton.type = "button";
	applyButton.className = "csshub-formatting-preview-apply";
	applyButton.textContent = previewApplyLabel(format);
	applyButton.addEventListener("click", () => {
		void applyPreviewedCode(code);
	});

	const closeButton = document.createElement("button");
	closeButton.type = "button";
	closeButton.className = "csshub-formatting-preview-close";
	closeButton.textContent = "Close";
	closeButton.addEventListener("click", hidePreview);

	actions.append(applyButton, closeButton);
	header.append(heading, actions);

	const pre = document.createElement("pre");
	pre.className = "csshub-formatting-preview-code";

	const codeEl = document.createElement("code");
	codeEl.className = "hljs";
	codeEl.innerHTML = highlightFormatPreviewCode(code);

	pre.append(codeEl);
	panel.append(header, pre);
	overlay.append(panel);
	overlay.addEventListener("click", (event) => {
		if (event.target === overlay) {
			hidePreview();
		}
	});

	shadow.append(style, overlay);
	document.body.append(host);
};

const runFormattingAction = async (
	format: EditorCodeFormat,
	mode: "preview" | "apply"
): Promise<void> => {
	const currentCode = await extractEditorCode();
	if (currentCode === null) {
		window.alert("CssHub could not read the CSSBattle editor.");
		return;
	}

	try {
		const formatted = await formatEditorCodeRemote(currentCode, format);
		if (mode === "preview") {
			const label = format === "prettified" ? "Prettified preview" : "Minified preview";
			showPreview(label, formatted, format);
			return;
		}
		await applyEditorCodeRemote(formatted);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Formatting failed";
		window.alert(`CssHub formatting failed: ${message}`);
	}
};

const clamp = (value: number, min: number, max: number): number => {
	return Math.min(Math.max(value, min), max);
};

const clampControlsPosition = (
	root: HTMLElement,
	left: number,
	top: number,
	width = root.offsetWidth || root.getBoundingClientRect().width,
	height = root.offsetHeight || root.getBoundingClientRect().height
): { left: number; top: number } => {
	const maxLeft = Math.max(POSITION_MARGIN, window.innerWidth - width - POSITION_MARGIN);
	const maxTop = Math.max(POSITION_MARGIN, window.innerHeight - height - POSITION_MARGIN);
	return {
		left: clamp(left, POSITION_MARGIN, maxLeft),
		top: clamp(top, POSITION_MARGIN, maxTop),
	};
};

const setControlsPosition = (root: HTMLElement, left: number, top: number): void => {
	root.classList.remove(FORMATTING_CONTROLS_DEFAULT_POSITION_CLASS);
	const clamped = clampControlsPosition(root, left, top);
	root.style.left = `${Math.round(clamped.left)}px`;
	root.style.top = `${Math.round(clamped.top)}px`;
	root.style.right = "auto";
	root.style.bottom = "auto";
};

const applyDefaultControlsPosition = (root: HTMLElement): void => {
	root.classList.add(FORMATTING_CONTROLS_DEFAULT_POSITION_CLASS);
	root.style.removeProperty("left");
	root.style.removeProperty("top");
	root.style.removeProperty("right");
	root.style.removeProperty("bottom");
};

const normalizeControlsPosition = (left: number, top: number): FormattingControlsPosition => {
	const viewportWidth = Math.max(window.innerWidth, 1);
	const viewportHeight = Math.max(window.innerHeight, 1);
	return {
		leftPct: left / viewportWidth,
		topPct: top / viewportHeight,
	};
};

const applyStoredControlsPosition = (): void => {
	const root = document.getElementById(FORMATTING_CONTROLS_ID);
	if (!root) {
		return;
	}

	if (!storedControlsPosition) {
		applyDefaultControlsPosition(root);
		return;
	}

	const apply = (): void => {
		const left = storedControlsPosition!.leftPct * window.innerWidth;
		const top = storedControlsPosition!.topPct * window.innerHeight;
		setControlsPosition(root, left, top);
	};

	if (root.offsetWidth > 0 && root.offsetHeight > 0) {
		apply();
		return;
	}

	requestAnimationFrame(() => {
		requestAnimationFrame(apply);
	});
};

const persistControlsPosition = async (root: HTMLElement): Promise<void> => {
	const left = Number.parseFloat(root.style.left);
	const top = Number.parseFloat(root.style.top);
	if (!Number.isFinite(left) || !Number.isFinite(top)) {
		return;
	}

	const position = normalizeControlsPosition(left, top);
	storedControlsPosition = position;

	try {
		await patchStoredSettings(() => ({
			formattingControlsPosition: position,
		}));
	} catch (_error) {
		/* ignore persistence failures */
	}
};

const ensureControlsResizeListener = (): void => {
	if (resizeListenerAttached) {
		return;
	}
	resizeListenerAttached = true;
	window.addEventListener("resize", () => {
		applyStoredControlsPosition();
	});
};

const moveFormattingControls = (
	root: HTMLElement,
	clientX: number,
	clientY: number
): void => {
	if (!activeDrag) {
		return;
	}

	const nextLeft = clientX - activeDrag.offsetX;
	const nextTop = clientY - activeDrag.offsetY;
	const clamped = clampControlsPosition(
		root,
		nextLeft,
		nextTop,
		activeDrag.width,
		activeDrag.height
	);

	root.style.left = `${Math.round(clamped.left)}px`;
	root.style.top = `${Math.round(clamped.top)}px`;
	root.style.right = "auto";
	root.style.bottom = "auto";
};

const makeFormattingControlsDraggable = (
	root: HTMLElement,
	handle: HTMLElement
): void => {
	const stopDrag = (event?: PointerEvent): void => {
		if (
			event &&
			typeof handle.hasPointerCapture === "function" &&
			handle.hasPointerCapture(event.pointerId)
		) {
			handle.releasePointerCapture(event.pointerId);
		}
		const didDrag = activeDrag !== null;
		activeDrag = null;
		root.classList.remove("csshub-formatting-controls-dragging");
		document.body.style.removeProperty("cursor");
		document.removeEventListener("pointermove", handlePointerMove);
		document.removeEventListener("pointerup", stopDrag);
		document.removeEventListener("pointercancel", stopDrag);
		if (didDrag) {
			void persistControlsPosition(root);
		}
	};

	const handlePointerMove = (event: PointerEvent): void => {
		if (!activeDrag) {
			return;
		}
		event.preventDefault();
		moveFormattingControls(root, event.clientX, event.clientY);
	};

	handle.addEventListener("pointerdown", (event) => {
		if (event.button !== 0) {
			return;
		}

		const rect = root.getBoundingClientRect();
		activeDrag = {
			offsetX: event.clientX - rect.left,
			offsetY: event.clientY - rect.top,
			width: rect.width || root.offsetWidth,
			height: rect.height || root.offsetHeight,
		};
		root.classList.add("csshub-formatting-controls-dragging");
		document.body.style.cursor = "grabbing";
		root.style.left = `${Math.round(rect.left)}px`;
		root.style.top = `${Math.round(rect.top)}px`;
		root.style.right = "auto";
		root.style.bottom = "auto";
		if (typeof handle.setPointerCapture === "function") {
			handle.setPointerCapture(event.pointerId);
		}
		event.preventDefault();

		document.addEventListener("pointermove", handlePointerMove);
		document.addEventListener("pointerup", stopDrag);
		document.addEventListener("pointercancel", stopDrag);
	});
};

const ensureFormattingStyles = (): void => {
	let style = document.getElementById(FORMATTING_STYLE_ID);
	if (!style) {
		style = document.createElement("style");
		style.id = FORMATTING_STYLE_ID;
		document.head.append(style);
	}

	style.textContent = `
#${FORMATTING_CONTROLS_ID} {
	position: fixed;
	z-index: 2147483645;
	display: flex;
	flex-direction: column;
	gap: 10px;
	width: min(268px, calc(100vw - 32px));
	padding: 14px 16px;
	border-radius: 12px;
	border: 1px solid rgba(148, 163, 184, 0.15);
	background: rgba(15, 23, 42, 0.94);
	box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
	font: 12px/1.35 system-ui, sans-serif;
	color: #e2e8f0;
}
#${FORMATTING_CONTROLS_ID}.${FORMATTING_CONTROLS_DEFAULT_POSITION_CLASS} {
	left: 16px;
	bottom: 16px;
}
#${FORMATTING_CONTROLS_ID}[hidden] {
	display: none !important;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-label {
	margin: 0;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: .04em;
	text-transform: uppercase;
	color: #94a3b8;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 0;
	padding: 0;
	cursor: grab !important;
	user-select: none;
	touch-action: none;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-header,
#${FORMATTING_CONTROLS_ID} .csshub-formatting-header * {
	cursor: grab !important;
}
#${FORMATTING_CONTROLS_ID}.csshub-formatting-controls-dragging,
#${FORMATTING_CONTROLS_ID}.csshub-formatting-controls-dragging * {
	cursor: grabbing !important;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-drag-hint {
	color: #64748b;
	font-size: 10px;
	line-height: 1;
	text-transform: lowercase;
	cursor: grab !important;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-columns {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
	column-gap: 13px;
	align-items: stretch;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-divider {
	background: rgba(148, 163, 184, 0.15);
	width: 1px;
	align-self: stretch;
}
#${FORMATTING_CONTROLS_ID} .csshub-formatting-section {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
}
#${FORMATTING_CONTROLS_ID} button {
	width: 100%;
	border: 1px solid rgba(148, 163, 184, 0.28);
	border-radius: 8px;
	background: rgba(30, 41, 59, 0.55);
	color: #e2e8f0;
	padding: 8px 10px;
	font: inherit;
	font-size: 11px;
	font-weight: 600;
	line-height: 1.25;
	text-align: center;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
#${FORMATTING_CONTROLS_ID} button:hover {
	background: rgba(30, 41, 59, 0.85);
	border-color: rgba(148, 163, 184, 0.4);
}
#${FORMATTING_CONTROLS_ID} button:active {
	transform: scale(0.98);
}
#${FORMATTING_CONTROLS_ID} button:focus-visible {
	outline: 2px solid rgba(249, 115, 22, 0.85);
	outline-offset: 2px;
}
#${FORMATTING_CONTROLS_ID} button.csshub-formatting-button-primary {
	background: linear-gradient(135deg, #ea580c, #c2410c);
	border-color: rgba(249, 115, 22, 0.5);
	color: #fff7ed;
}
#${FORMATTING_CONTROLS_ID} button.csshub-formatting-button-primary:hover {
	background: linear-gradient(
		135deg,
		color-mix(in srgb, #ea580c 88%, white),
		color-mix(in srgb, #c2410c 85%, white)
	);
	border-color: rgba(251, 146, 60, 0.58);
}
#${FORMATTING_CONTROLS_ID} button.csshub-formatting-button-primary:active {
	transform: scale(0.98);
}
`;
};

const mountFormattingControls = (): void => {
	const existing = document.getElementById(FORMATTING_CONTROLS_ID);
	if (existing) {
		if (existing.querySelector(".csshub-formatting-header")) {
			applyStoredControlsPosition();
			return;
		}
		existing.remove();
	}
	if (!document.body) {
		return;
	}

	ensureFormattingStyles();

	const root = document.createElement("div");
	root.id = FORMATTING_CONTROLS_ID;
	root.hidden = !controlsVisible;
	root.classList.add(FORMATTING_CONTROLS_DEFAULT_POSITION_CLASS);

	const header = document.createElement("div");
	header.className = "csshub-formatting-header";
	header.title = "Drag to move CssHub format controls";

	const label = document.createElement("p");
	label.className = "csshub-formatting-label";
	label.textContent = "CssHub format";

	const dragHint = document.createElement("span");
	dragHint.className = "csshub-formatting-drag-hint";
	dragHint.textContent = "drag";

	header.append(label, dragHint);
	makeFormattingControlsDraggable(root, header);

	const makeButton = (
		text: string,
		onClick: () => void,
		variant: "default" | "primary" = "default"
	): HTMLButtonElement => {
		const button = document.createElement("button");
		button.type = "button";
		button.textContent = text;
		if (variant === "primary") {
			button.className = "csshub-formatting-button-primary";
		}
		button.addEventListener("click", () => {
			void onClick();
		});
		return button;
	};

	const prettifySection = document.createElement("div");
	prettifySection.className = "csshub-formatting-section";
	prettifySection.append(
		makeButton("Preview prettified", () => {
			void runFormattingAction("prettified", "preview");
		}),
		makeButton(
			"Prettify",
			() => {
				void runFormattingAction("prettified", "apply");
			},
			"primary"
		)
	);

	const minifySection = document.createElement("div");
	minifySection.className = "csshub-formatting-section";
	minifySection.append(
		makeButton("Preview minified", () => {
			void runFormattingAction("minified", "preview");
		}),
		makeButton(
			"Minify",
			() => {
				void runFormattingAction("minified", "apply");
			},
			"primary"
		)
	);

	const divider = document.createElement("div");
	divider.className = "csshub-formatting-divider";
	divider.setAttribute("aria-hidden", "true");

	const columns = document.createElement("div");
	columns.className = "csshub-formatting-columns";
	columns.append(prettifySection, divider, minifySection);

	root.append(header, columns);
	document.body.append(root);
	applyStoredControlsPosition();
	ensureControlsResizeListener();
};

const scheduleFormattingControlsMount = (): void => {
	const tryMount = async (): Promise<void> => {
		await loadFormattingControlsSettings();
		mountFormattingControls();
	};

	if (document.body) {
		void tryMount();
		return;
	}

	const mountWhenBodyExists = (): void => {
		if (!document.body || document.getElementById(FORMATTING_CONTROLS_ID)) {
			return;
		}
		void tryMount();
	};

	document.addEventListener("DOMContentLoaded", mountWhenBodyExists, { once: true });

	const observer = new MutationObserver(() => {
		mountWhenBodyExists();
		if (document.getElementById(FORMATTING_CONTROLS_ID)) {
			observer.disconnect();
		}
	});
	observer.observe(document.documentElement, { childList: true, subtree: true });
};

export const initFormattingControls = (): void => {
	if (controlsInitialized) {
		return;
	}
	controlsInitialized = true;

	scheduleFormattingControlsMount();

	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local" || !changes[STORAGE_KEY]) {
			return;
		}
		const nextState = changes[STORAGE_KEY].newValue as { settings?: unknown } | undefined;
		if (!nextState?.settings) {
			return;
		}
		applySettingsFromStorage(nextState.settings);
	});
};
