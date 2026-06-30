/** Shared dark/light theme for popup, settings, and injected page UI. */

export const LEGACY_POPUP_THEME_STORAGE_KEY = "csshub_popup_theme_v1";
export const EXTENSION_THEME_STORAGE_KEY = "csshub_extension_theme_v1";

export type ExtensionTheme = "dark" | "light";

export const DEFAULT_EXTENSION_THEME: ExtensionTheme = "dark";

export const applyExtensionTheme = (theme: ExtensionTheme): void => {
	document.documentElement.dataset.theme = theme;
};

const isExtensionTheme = (value: unknown): value is ExtensionTheme =>
	value === "light" || value === "dark";

export const loadExtensionTheme = async (): Promise<ExtensionTheme> => {
	const result = await chrome.storage.local.get([
		EXTENSION_THEME_STORAGE_KEY,
		LEGACY_POPUP_THEME_STORAGE_KEY,
	]);
	const current = result[EXTENSION_THEME_STORAGE_KEY];
	if (isExtensionTheme(current)) {
		return current;
	}
	const legacy = result[LEGACY_POPUP_THEME_STORAGE_KEY];
	if (isExtensionTheme(legacy)) {
		await chrome.storage.local.set({ [EXTENSION_THEME_STORAGE_KEY]: legacy });
		return legacy;
	}
	return DEFAULT_EXTENSION_THEME;
};

export const saveExtensionTheme = async (theme: ExtensionTheme): Promise<void> => {
	await chrome.storage.local.set({
		[EXTENSION_THEME_STORAGE_KEY]: theme,
		[LEGACY_POPUP_THEME_STORAGE_KEY]: theme,
	});
};
