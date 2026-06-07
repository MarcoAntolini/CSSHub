import {
	capturePreviewFromDocumentAsync,
	isLikelyPreviewFrameDocument,
} from "./previewDocumentCapture";

const capturePreviewInChildFrame = async (): Promise<string | null> => {
	try {
		if (!isLikelyPreviewFrameDocument(document)) {
			return null;
		}
		return await capturePreviewFromDocumentAsync(document);
	} catch {
		return null;
	}
};

(
	globalThis as unknown as {
		__csshubCapturePreviewInFrame?: typeof capturePreviewInChildFrame;
	}
).__csshubCapturePreviewInFrame = capturePreviewInChildFrame;
