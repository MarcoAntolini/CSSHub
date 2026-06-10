import { fetchRemoteImageAsDataUrl } from "@/remoteImageFetch";
import type { Handler } from "./types";

export const handleFetchRemoteImage: Handler<"fetchRemoteImage"> = async (
	data,
	sendResponse
) => {
	try {
		const dataUrl = await fetchRemoteImageAsDataUrl(data.url);
		if (!dataUrl) {
			sendResponse({ ok: false, error: "Image fetch failed" });
			return;
		}
		sendResponse({ ok: true, data: { dataUrl } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Image fetch failed";
		sendResponse({ ok: false, error: message });
	}
};
