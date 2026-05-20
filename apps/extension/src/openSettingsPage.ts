export const openSettingsPage = (): void => {
	// openOptionsPage() from the toolbar popup is flaky (popup closes and navigation may never run).
	// Same HTML as options_ui.page; tabs permission is declared in the manifest.
	const url = chrome.runtime.getURL("settings.html");
	void chrome.tabs.create({ url });
};
