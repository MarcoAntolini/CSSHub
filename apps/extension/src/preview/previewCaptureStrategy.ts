import type { ElementDimensions } from "@/shared/contracts";

export const PREVIEW_CAPTURE_CONFIG = {
	postSubmitSettleDelayMs: 750,
	iframeCaptureMaxAttempts: 8,
	iframeCaptureRetryMs: 400,
} as const;

export type PreviewCaptureStrategyDeps = {
	sleep: (ms: number) => Promise<void>;
	waitForPreviewIframe: () => Promise<HTMLIFrameElement | null>;
	findPreviewIframe: () => HTMLIFrameElement | null;
	getIframeDimensions: (iframe: HTMLIFrameElement) => ElementDimensions | null;
	captureViaBackground: (dimensions: ElementDimensions | null) => Promise<string | null>;
	captureFromIframe: (iframe: HTMLIFrameElement) => Promise<string | null>;
	isExtensionContextInvalidated: (error: unknown) => boolean;
	onBackgroundFailure: (error: unknown) => void;
	onIframeFailure: (error: unknown) => void;
	onExhausted: () => void;
};

export const executePreviewCaptureStrategy = async (
	deps: PreviewCaptureStrategyDeps
): Promise<string | null> => {
	const { postSubmitSettleDelayMs, iframeCaptureMaxAttempts, iframeCaptureRetryMs } =
		PREVIEW_CAPTURE_CONFIG;

	await deps.sleep(postSubmitSettleDelayMs);

	const previewIframe =
		(await deps.waitForPreviewIframe()) ?? deps.findPreviewIframe();
	const dimensions = previewIframe ? deps.getIframeDimensions(previewIframe) : null;

	try {
		const fromScreenshot = await deps.captureViaBackground(dimensions);
		if (fromScreenshot) {
			return fromScreenshot;
		}
	} catch (error) {
		if (deps.isExtensionContextInvalidated(error)) {
			throw error;
		}
		deps.onBackgroundFailure(error);
	}

	for (let attempt = 0; attempt < iframeCaptureMaxAttempts; attempt++) {
		try {
			const currentIframe = previewIframe ?? deps.findPreviewIframe();
			if (currentIframe) {
				const localCapture = await deps.captureFromIframe(currentIframe);
				if (localCapture) {
					return localCapture;
				}
			}
		} catch (error) {
			if (deps.isExtensionContextInvalidated(error)) {
				throw error;
			}
			deps.onIframeFailure(error);
		}

		if (attempt < iframeCaptureMaxAttempts - 1) {
			await deps.sleep(iframeCaptureRetryMs);
		}
	}

	deps.onExhausted();
	return null;
};
