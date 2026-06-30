import { extensionSettingsSchema, type ExtensionSettings } from "@/shared/contracts";

export const defaultSettings = (): ExtensionSettings =>
	extensionSettingsSchema.parse({
		threshold: 95,
		selectedRepoFullName: null,
		selectedBranch: null,
		systemNotificationsEnabled: true,
		repositoryReadmeMode: "managed-section",
		pageFeedbackPlacement: "bottom-right",
		savedCodeFormat: "original",
		includePrettifiedCode: false,
		showFormattingControls: true,
	});

export const parseStoredSettings = (value: unknown): ExtensionSettings => {
	const parsed = extensionSettingsSchema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}
	return defaultSettings();
};
