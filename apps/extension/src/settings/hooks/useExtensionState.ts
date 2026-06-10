import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
	branchSchema,
	extensionSettingsSchema,
	extensionStateResponseSchema,
	repoSchema,
	type ExtensionSettings,
	type Branch,
	type Repo,
} from "@/shared/contracts";
import {
	BackgroundError,
	parseBackgroundOk,
	parseBackgroundOkVoid,
	sendBackgroundMessage,
} from "@/shared/messaging";
import type { LoadedState, UiNotice } from "@/settings/types";

export const useExtensionState = () => {
	const [data, setData] = useState<LoadedState | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);

	const pushToast = useCallback((payload: UiNotice): void => {
		if (payload.level === "success") {
			toast.success(payload.message);
			return;
		}
		if (payload.level === "error") {
			toast.error(payload.message);
			return;
		}
		toast.warning(payload.message);
	}, []);

	const loadState = useCallback(async (): Promise<void> => {
		setLoading(true);
		try {
			const response = await sendBackgroundMessage({
				action: "getExtensionState",
				refreshRepos: true,
			});
			const parsed = parseBackgroundOk(
				response,
				extensionStateResponseSchema,
				"Failed to load settings"
			);
			setData({
				auth: parsed.auth,
				settings: extensionSettingsSchema.parse(parsed.settings),
				repos: parsed.repos,
				lastSubmission: parsed.lastSubmission,
				lastSubmissionAccepted: parsed.lastSubmissionAccepted,
				lastIngestion: parsed.lastIngestion,
				recentEvents: parsed.recentEvents,
			});
		} catch (error) {
			pushToast({
				level: "error",
				message:
					error instanceof BackgroundError
						? error.message
						: "Failed to load settings",
			});
		} finally {
			setLoading(false);
		}
	}, [pushToast]);

	const saveSettingsRemote = useCallback(
		async (next: ExtensionSettings): Promise<boolean> => {
			setBusy(true);
			try {
				const response = await sendBackgroundMessage({
					action: "saveSettings",
					settings: next,
				});
				parseBackgroundOkVoid(response, "Could not save settings");
				setData((prev) => (prev ? { ...prev, settings: next } : prev));
				pushToast({
					level: "success",
					message: "Settings updated",
				});
				return true;
			} catch (error) {
				pushToast({
					level: "error",
					message:
						error instanceof BackgroundError
							? error.message
							: "Could not save settings",
				});
				return false;
			} finally {
				setBusy(false);
			}
		},
		[pushToast]
	);

	const refreshReposOnly = useCallback(async (): Promise<Repo[]> => {
		try {
			const response = await sendBackgroundMessage({
				action: "listRepos",
			});
			return parseBackgroundOk(
				response,
				repoSchema.array(),
				"Could not list repositories"
			);
		} catch (error) {
			pushToast({
				level: "error",
				message:
					error instanceof BackgroundError
						? error.message
						: "Could not list repositories",
			});
			return [];
		}
	}, [pushToast]);

	const refreshBranchesOnly = useCallback(
		async (repoFullName: string): Promise<Branch[]> => {
			try {
				const response = await sendBackgroundMessage({
					action: "listBranches",
					repoFullName,
				});
				return parseBackgroundOk(
					response,
					branchSchema.array(),
					"Could not list branches"
				);
			} catch (error) {
				pushToast({
					level: "error",
					message:
						error instanceof BackgroundError
							? error.message
							: "Could not list branches",
				});
				return [];
			}
		},
		[pushToast]
	);

	useEffect(() => {
		void loadState();
	}, [loadState]);

	return {
		data,
		setData,
		loading,
		busy,
		setBusy,
		loadState,
		saveSettingsRemote,
		refreshReposOnly,
		refreshBranchesOnly,
		pushToast,
	};
};
