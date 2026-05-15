export const POPUP_THEME_STORAGE_KEY = "csshub_popup_theme_v1";

export type PopupTheme = "dark" | "light";

export const DEFAULT_POPUP_THEME: PopupTheme = "dark";

export const applyPopupTheme = (theme: PopupTheme): void => {
	document.documentElement.dataset.theme = theme;
};

export const loadPopupTheme = async (): Promise<PopupTheme> => {
	const result = await chrome.storage.local.get(POPUP_THEME_STORAGE_KEY);
	const value = result[POPUP_THEME_STORAGE_KEY];
	if (value === "light" || value === "dark") {
		return value;
	}
	return DEFAULT_POPUP_THEME;
};

export const savePopupTheme = async (theme: PopupTheme): Promise<void> => {
	await chrome.storage.local.set({ [POPUP_THEME_STORAGE_KEY]: theme });
};
