import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRemoteImageAsDataUrl } from "@/remoteImageFetch";

describe("fetchRemoteImageAsDataUrl", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns data URLs unchanged", async () => {
		const dataUrl = "data:image/png;base64,abc";
		await expect(fetchRemoteImageAsDataUrl(dataUrl)).resolves.toBe(dataUrl);
	});

	it("converts a successful image response to a data URL", async () => {
		const bytes = new Uint8Array([137, 80, 78, 71]);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				headers: { get: () => "image/png" },
				arrayBuffer: async () => bytes.buffer,
			})
		);

		const result = await fetchRemoteImageAsDataUrl(
			"https://firebasestorage.googleapis.com/v0/b/cssbattleapp.appspot.com/o/user%2Fx%2Ftargets%2Ftarget_abc.png?alt=media"
		);
		expect(result?.startsWith("data:image/png;base64,")).toBe(true);
	});
});
