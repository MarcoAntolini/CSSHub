import {
	EXTENSION_THEME_STORAGE_KEY,
	loadExtensionTheme,
	type ExtensionTheme,
} from "./extensionTheme";
import { injectedUiColorsForTheme } from "./injectedUiTheme";

let currentTheme: ExtensionTheme = "dark";
let themeInitialized = false;
const themeListeners = new Set<(theme: ExtensionTheme) => void>();

export const getInjectedUiTheme = (): ExtensionTheme => currentTheme;

export const getInjectedUiColors = () => injectedUiColorsForTheme(currentTheme);

export const onInjectedUiThemeChange = (
	listener: (theme: ExtensionTheme) => void
): (() => void) => {
	themeListeners.add(listener);
	return () => {
		themeListeners.delete(listener);
	};
};

const applyTheme = (theme: ExtensionTheme): void => {
	if (currentTheme === theme) {
		return;
	}
	currentTheme = theme;
	for (const listener of themeListeners) {
		listener(theme);
	}
};

export const initInjectedUiTheme = (): void => {
	if (themeInitialized) {
		return;
	}
	themeInitialized = true;

	void loadExtensionTheme().then(applyTheme);

	chrome.storage.onChanged.addListener((changes, areaName) => {
		if (areaName !== "local" || !changes[EXTENSION_THEME_STORAGE_KEY]) {
			return;
		}
		const next = changes[EXTENSION_THEME_STORAGE_KEY].newValue;
		if (next === "light" || next === "dark") {
			applyTheme(next);
		}
	});
};

export const buildFormattingControlsStyles = (
	controlId: string,
	defaultPositionClass: string
): string => {
	const c = getInjectedUiColors();
	return `
#${controlId} {
	position: fixed;
	z-index: 2147483645;
	display: flex;
	flex-direction: column;
	gap: 10px;
	width: min(268px, calc(100vw - 32px));
	padding: 14px 16px;
	border-radius: 12px;
	border: 1px solid ${c.border};
	background: ${c.surface};
	box-shadow: ${c.panelShadow};
	font: 12px/1.35 system-ui, sans-serif;
	color: ${c.text};
}
#${controlId}.${defaultPositionClass} {
	left: 16px;
	bottom: 16px;
}
#${controlId}[hidden] {
	display: none !important;
}
#${controlId} .csshub-formatting-label {
	margin: 0;
	font-size: 11px;
	font-weight: 600;
	letter-spacing: .04em;
	text-transform: uppercase;
	color: ${c.label};
}
#${controlId} .csshub-formatting-header {
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
#${controlId} .csshub-formatting-header,
#${controlId} .csshub-formatting-header * {
	cursor: grab !important;
}
#${controlId}.csshub-formatting-controls-dragging,
#${controlId}.csshub-formatting-controls-dragging * {
	cursor: grabbing !important;
}
#${controlId} .csshub-formatting-drag-hint {
	color: ${c.subtle};
	font-size: 10px;
	line-height: 1;
	text-transform: lowercase;
	cursor: grab !important;
}
#${controlId} .csshub-formatting-columns {
	display: grid;
	grid-template-columns: minmax(0, 1fr) 1px minmax(0, 1fr);
	column-gap: 13px;
	align-items: stretch;
}
#${controlId} .csshub-formatting-divider {
	background: ${c.border};
	width: 1px;
	align-self: stretch;
}
#${controlId} .csshub-formatting-section {
	display: flex;
	flex-direction: column;
	gap: 8px;
	min-width: 0;
}
#${controlId} button {
	width: 100%;
	border: 1px solid ${c.buttonBorder};
	border-radius: 8px;
	background: ${c.buttonBg};
	color: ${c.text};
	padding: 8px 10px;
	font: inherit;
	font-size: 11px;
	font-weight: 600;
	line-height: 1.25;
	text-align: center;
	cursor: pointer;
	transition: background 0.15s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.15s cubic-bezier(0.32, 0.72, 0, 1), transform 0.1s cubic-bezier(0.32, 0.72, 0, 1);
}
#${controlId} button:hover {
	background: ${c.buttonHoverBg};
	border-color: ${c.buttonBorder};
}
#${controlId} button:active {
	transform: scale(0.98);
}
#${controlId} button:focus-visible {
	outline: 2px solid ${c.focusRing};
	outline-offset: 2px;
}
#${controlId} button.csshub-formatting-button-primary {
	background: ${c.primaryBg};
	border-color: ${c.primaryBorder};
	color: ${c.primaryText};
}
#${controlId} button.csshub-formatting-button-primary:hover {
	background: ${c.primaryHoverBg};
}
#${controlId} button.csshub-formatting-button-primary:active {
	transform: scale(0.98);
}
`;
};

export const buildFormatPreviewOverlayStyles = (): string => {
	const c = getInjectedUiColors();
	return `
:host {
	position: fixed;
	inset: 0;
	z-index: 2147483646;
}
.csshub-formatting-preview-overlay {
	position: fixed;
	inset: 0;
	display: grid;
	place-items: center;
	padding: 24px;
	background: ${c.overlayBg};
}
.csshub-formatting-preview-panel {
	width: min(760px, 100%);
	max-height: min(70vh, 640px);
	display: flex;
	flex-direction: column;
	border-radius: 14px;
	border: 1px solid ${c.border};
	background: ${c.surfaceStrong};
	box-shadow: ${c.panelShadow};
	overflow: hidden;
}
.csshub-formatting-preview-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 14px;
	border-bottom: 1px solid ${c.border};
}
.csshub-formatting-preview-title {
	margin: 0;
	font: 600 13px/1.3 system-ui, sans-serif;
	color: ${c.text};
}
.csshub-formatting-preview-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}
.csshub-formatting-preview-apply,
.csshub-formatting-preview-close {
	border: 1px solid ${c.buttonBorder};
	border-radius: 8px;
	background: ${c.buttonBg};
	color: ${c.text};
	padding: 6px 10px;
	font: 600 12px/1.25 system-ui, sans-serif;
	cursor: pointer;
}
.csshub-formatting-preview-apply {
	background: ${c.primaryBg};
	border-color: ${c.primaryBorder};
	color: ${c.primaryText};
}
.csshub-formatting-preview-apply:hover {
	background: ${c.primaryHoverBg};
}
.csshub-formatting-preview-close:hover {
	background: ${c.buttonHoverBg};
}
`;
};
