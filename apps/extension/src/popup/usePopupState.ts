import { useCallback, useEffect, useRef, useState } from "react";
import {
	extensionSettingsSchema,
	extensionStateResponseSchema,
} from "@/shared/contracts";
import {
	BackgroundError,
	parseBackgroundOk,
	parseBackgroundOkVoid,
	sendBackgroundMessage,
} from "@/shared/messaging";
import { POPUP_ERRORS, THRESHOLD_SAVE_DEBOUNCE_MS } from "./constants";
import type { PopupState } from "./types";
import { clampThreshold } from "./utils";

export const usePopupState = (): {
	data: PopupState | null;
	loading: boolean;
	status: "idle" | "saving" | "error";
	errorMessage: string | null;
	thresholdDraft: number;
	setThresholdDraft: (value: number) => void;
	reload: () => Promise<void>;
} => {
	const [data, setData] = useState<PopupState | null>(null);
	const [loading, setLoading] = useState(true);
	const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [thresholdDraft, setThresholdDraft] = useState(95);
	const hasLoadedOnceRef = useRef(false);

	const load = useCallback(async (): Promise<void> => {
		const shouldShowLoading = !hasLoadedOnceRef.current;
		if (shouldShowLoading) {
			setLoading(true);
		}
		try {
			const response = await sendBackgroundMessage({
				action: "getExtensionState",
			});
			const parsed = parseBackgroundOk(
				response,
				extensionStateResponseSchema,
				POPUP_ERRORS.loadState
			);
			setErrorMessage(null);
			setData({
				auth: parsed.auth,
				settings: extensionSettingsSchema.parse(parsed.settings),
				lastSubmission: parsed.lastSubmission,
				lastSubmissionAccepted: parsed.lastSubmissionAccepted,
				lastIngestion: parsed.lastIngestion,
				submissionProcessing: parsed.submissionProcessing,
				lastCaptureFailure: parsed.lastCaptureFailure,
			});
			setThresholdDraft(parsed.settings.threshold);
		} catch (error) {
			setErrorMessage(
				error instanceof BackgroundError ? error.message : POPUP_ERRORS.loadState
			);
			if (shouldShowLoading) {
				setLoading(false);
			}
			setStatus("error");
			return;
		}
		hasLoadedOnceRef.current = true;
		if (shouldShowLoading) {
			setLoading(false);
		}
		setStatus("idle");
	}, []);

	const saveThreshold = useCallback(
		async (threshold: number): Promise<void> => {
			if (!data) {
				return;
			}
			const next = clampThreshold(threshold);
			setStatus("saving");
			try {
				const response = await sendBackgroundMessage({
					action: "saveSettings",
					settings: {
						...data.settings,
						threshold: next,
					},
				});
				parseBackgroundOkVoid(response, POPUP_ERRORS.saveThreshold);
			} catch (error) {
				setStatus("error");
				setErrorMessage(
					error instanceof BackgroundError
						? error.message
						: POPUP_ERRORS.saveThreshold
				);
				return;
			}
			setErrorMessage(null);
			setData({
				...data,
				settings: extensionSettingsSchema.parse({
					...data.settings,
					threshold: next,
				}),
			});
			setStatus("idle");
		},
		[data]
	);

	useEffect(() => {
		if (!data) {
			return;
		}
		const current = data.settings.threshold;
		const next = clampThreshold(thresholdDraft);
		if (current === next) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			void saveThreshold(next);
		}, THRESHOLD_SAVE_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [thresholdDraft, data, saveThreshold]);

	useEffect(() => {
		void load();
		const onStorageChanged = (): void => {
			void load();
		};
		chrome.storage.onChanged.addListener(onStorageChanged);
		return () => {
			chrome.storage.onChanged.removeListener(onStorageChanged);
		};
	}, [load]);

	return {
		data,
		loading,
		status,
		errorMessage,
		thresholdDraft,
		setThresholdDraft,
		reload: load,
	};
};
