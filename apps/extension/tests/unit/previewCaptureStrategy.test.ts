import { describe, expect, it, vi } from "vitest";
import { executePreviewCaptureStrategy } from "@/preview/previewCaptureStrategy";

describe("executePreviewCaptureStrategy", () => {
	it("returns background capture when available", async () => {
		const result = await executePreviewCaptureStrategy({
			sleep: vi.fn().mockResolvedValue(undefined),
			waitForPreviewIframe: vi.fn().mockResolvedValue(null),
			findPreviewIframe: vi.fn().mockReturnValue(null),
			getIframeDimensions: vi.fn().mockReturnValue(null),
			captureViaBackground: vi.fn().mockResolvedValue("data:image/png;base64,abc"),
			captureFromIframe: vi.fn(),
			isExtensionContextInvalidated: () => false,
			onBackgroundFailure: vi.fn(),
			onIframeFailure: vi.fn(),
			onExhausted: vi.fn(),
		});

		expect(result).toBe("data:image/png;base64,abc");
	});

	it("falls back to iframe capture when background returns null", async () => {
		const iframe = {} as HTMLIFrameElement;
		const result = await executePreviewCaptureStrategy({
			sleep: vi.fn().mockResolvedValue(undefined),
			waitForPreviewIframe: vi.fn().mockResolvedValue(iframe),
			findPreviewIframe: vi.fn().mockReturnValue(iframe),
			getIframeDimensions: vi.fn().mockReturnValue({
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			}),
			captureViaBackground: vi.fn().mockResolvedValue(null),
			captureFromIframe: vi.fn().mockResolvedValue("data:image/png;base64,local"),
			isExtensionContextInvalidated: () => false,
			onBackgroundFailure: vi.fn(),
			onIframeFailure: vi.fn(),
			onExhausted: vi.fn(),
		});

		expect(result).toBe("data:image/png;base64,local");
	});
});
