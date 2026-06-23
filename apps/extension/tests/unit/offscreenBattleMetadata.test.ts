// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	BATTLE_METADATA_PROBE_RESULT,
	READ_BATTLE_METADATA_OFFSCREEN,
} from "@/battleMetadataMessages";

type RuntimeMessageListener = (
	message: unknown,
	sender: chrome.runtime.MessageSender,
	sendResponse: (response: unknown) => void
) => boolean | void;

const loadOffscreenModule = async (): Promise<{
	listener: RuntimeMessageListener;
}> => {
	let listener: RuntimeMessageListener | null = null;
	vi.stubGlobal("chrome", {
		runtime: {
			onMessage: {
				addListener: vi.fn((nextListener: RuntimeMessageListener) => {
					listener = nextListener;
				}),
			},
		},
	});
	await import("@/offscreenBattleMetadata");
	if (!listener) {
		throw new Error("Offscreen listener was not registered");
	}
	return { listener };
};

describe("offscreenBattleMetadata", () => {
	afterEach(() => {
		vi.resetModules();
		vi.unstubAllGlobals();
		vi.useRealTimers();
		document.body.innerHTML = "";
	});

	it("correlates probe responses by request id and cleans up the iframe", async () => {
		const { listener } = await loadOffscreenModule();
		const sendResponse = vi.fn();

		expect(
			listener(
				{
					type: READ_BATTLE_METADATA_OFFSCREEN,
					requestId: "request-1",
					url: "https://cssbattle.dev/battle/1",
					timeoutMs: 1_000,
					intervalMs: 10,
					stableTicksRequired: 1,
				},
				{},
				sendResponse
			)
		).toBe(true);
		expect(document.querySelectorAll("iframe")).toHaveLength(1);
		expect(document.querySelector("iframe")?.src).toContain(
			"csshubMetadataRequestId=request-1"
		);

		listener(
			{
				type: BATTLE_METADATA_PROBE_RESULT,
				requestId: "request-1",
				metadata: {
					totalChallenges: 3,
					status: "finished",
				},
			},
			{},
			vi.fn()
		);

		expect(sendResponse).toHaveBeenCalledWith({
			ok: true,
			metadata: {
				totalChallenges: 3,
				status: "finished",
			},
		});
		expect(document.querySelectorAll("iframe")).toHaveLength(0);
	});

	it("times out pending requests and cleans up the iframe", async () => {
		vi.useFakeTimers();
		const { listener } = await loadOffscreenModule();
		const sendResponse = vi.fn();

		listener(
			{
				type: READ_BATTLE_METADATA_OFFSCREEN,
				requestId: "request-2",
				url: "https://cssbattle.dev/battle/2",
				timeoutMs: 50,
				intervalMs: 10,
				stableTicksRequired: 1,
			},
			{},
			sendResponse
		);

		expect(document.querySelectorAll("iframe")).toHaveLength(1);

		vi.advanceTimersByTime(50);

		expect(sendResponse).toHaveBeenCalledWith({
			ok: false,
			error: "CSSBattle offscreen battle page timed out before metadata was read",
		});
		expect(document.querySelectorAll("iframe")).toHaveLength(0);
	});
});
