export const bytesToDataUrl = (bytes: Uint8Array, contentType = "image/png"): string => {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return `data:${contentType};base64,${btoa(binary)}`;
};

/** Fetch image bytes (service worker / host_permissions — not subject to page CORS). */
export const fetchRemoteImageAsDataUrl = async (url: string): Promise<string | null> => {
	if (url.startsWith("data:")) {
		return url;
	}

	try {
		const response = await fetch(url);
		if (!response.ok) {
			return null;
		}
		const contentType =
			response.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/png";
		const bytes = new Uint8Array(await response.arrayBuffer());
		return bytesToDataUrl(bytes, contentType);
	} catch (_error) {
		return null;
	}
};
