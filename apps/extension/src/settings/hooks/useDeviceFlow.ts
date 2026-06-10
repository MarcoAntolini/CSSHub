import { useCallback, useEffect, useRef, useState } from "react";
import {
	deviceFlowStartResponseSchema,
	popupToBackgroundMessageSchema,
} from "@/shared/contracts";
import type { UiNotice } from "@/settings/types";

type UseDeviceFlowOptions = {
	setBusy: (busy: boolean) => void;
	pushToast: (payload: UiNotice) => void;
	loadState: () => Promise<void>;
};

export const useDeviceFlow = ({
	setBusy,
	pushToast,
	loadState,
}: UseDeviceFlowOptions) => {
	const [webAuthInProgress, setWebAuthInProgress] = useState(false);
	const [deviceFlow, setDeviceFlow] = useState<{
		deviceCode: string;
		userCode: string;
		verificationUri: string;
		verificationUriComplete: string | null;
		interval: number;
	} | null>(null);
	const [deviceCopyOk, setDeviceCopyOk] = useState(false);
	const deviceCopyOkTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (!deviceFlow) {
			setDeviceCopyOk(false);
			if (deviceCopyOkTimerRef.current !== null) {
				window.clearTimeout(deviceCopyOkTimerRef.current);
				deviceCopyOkTimerRef.current = null;
			}
		}
	}, [deviceFlow]);

	useEffect(() => {
		return () => {
			if (deviceCopyOkTimerRef.current !== null) {
				window.clearTimeout(deviceCopyOkTimerRef.current);
			}
		};
	}, []);

	const beginWebFlow = useCallback(async (): Promise<void> => {
		setDeviceFlow(null);
		setBusy(true);
		setWebAuthInProgress(true);
		try {
			const message = popupToBackgroundMessageSchema.parse({
				action: "startGithubWebFlow",
			});
			const response = await chrome.runtime.sendMessage(message);
			if (!response?.ok) {
				pushToast({
					level: "error",
					message: response?.error ?? "Web OAuth failed",
				});
				return;
			}
			pushToast({
				level: "success",
				message: "GitHub account connected",
			});
			await loadState();
		} finally {
			setBusy(false);
			setWebAuthInProgress(false);
		}
	}, [loadState, pushToast, setBusy]);

	const beginDeviceFlow = useCallback(async (): Promise<void> => {
		setWebAuthInProgress(false);
		setDeviceCopyOk(false);
		if (deviceCopyOkTimerRef.current !== null) {
			window.clearTimeout(deviceCopyOkTimerRef.current);
			deviceCopyOkTimerRef.current = null;
		}
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "startGithubDeviceFlow",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Device flow failed",
			});
			return;
		}
		const payload = deviceFlowStartResponseSchema.safeParse(response.data);
		if (!payload.success) {
			pushToast({
				level: "error",
				message: "Invalid device flow response",
			});
			return;
		}
		setDeviceFlow({
			deviceCode: payload.data.deviceCode,
			userCode: payload.data.userCode,
			verificationUri: payload.data.verificationUri,
			verificationUriComplete: payload.data.verificationUriComplete,
			interval: payload.data.interval,
		});
		await chrome.tabs.create({
			url: payload.data.verificationUriComplete ?? payload.data.verificationUri,
		});
	}, [pushToast, setBusy]);

	const pollDevice = useCallback(async (): Promise<void> => {
		if (!deviceFlow) {
			return;
		}
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "pollGithubDeviceFlow",
			deviceCode: deviceFlow.deviceCode,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Polling failed",
			});
			return;
		}
		if (response.data?.status === "pending") {
			pushToast({
				level: "warn",
				message: "Approve the device login on GitHub first, then try again.",
			});
			return;
		}
		if (response.data?.status === "authenticated") {
			setDeviceFlow(null);
			pushToast({
				level: "success",
				message: "GitHub account connected",
			});
			await loadState();
		}
	}, [deviceFlow, loadState, pushToast, setBusy]);

	const copyDeviceUserCode = useCallback(async (): Promise<void> => {
		if (!deviceFlow) {
			return;
		}
		try {
			await navigator.clipboard.writeText(deviceFlow.userCode);
			pushToast({
				level: "success",
				message: "User code copied",
			});
			setDeviceCopyOk(true);
			if (deviceCopyOkTimerRef.current !== null) {
				window.clearTimeout(deviceCopyOkTimerRef.current);
			}
			deviceCopyOkTimerRef.current = window.setTimeout(() => {
				setDeviceCopyOk(false);
				deviceCopyOkTimerRef.current = null;
			}, 2500);
		} catch {
			pushToast({
				level: "warn",
				message: "Could not copy — select the code manually",
			});
		}
	}, [deviceFlow, pushToast]);

	const openDeviceVerification = useCallback((): void => {
		if (!deviceFlow) {
			return;
		}
		void chrome.tabs.create({
			url: deviceFlow.verificationUriComplete ?? deviceFlow.verificationUri,
		});
	}, [deviceFlow]);

	const clearDeviceFlow = useCallback((): void => {
		setDeviceFlow(null);
	}, []);

	return {
		deviceFlow,
		deviceCopyOk,
		webAuthInProgress,
		beginWebFlow,
		beginDeviceFlow,
		pollDevice,
		copyDeviceUserCode,
		openDeviceVerification,
		clearDeviceFlow,
	};
};
