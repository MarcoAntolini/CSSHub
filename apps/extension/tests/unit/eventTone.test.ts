import { describe, expect, it } from "vitest";
import { getEventBadgeLabel, statusTextFromTone } from "@/shared/eventTone";
import type { SyncEvent } from "@/shared/contracts";

describe("eventTone capture failure labels", () => {
	it("maps CAPTURE_FAILED to capture failed instead of skipped", () => {
		expect(statusTextFromTone("warn", "info", "CAPTURE_FAILED")).toBe("capture failed");
		expect(statusTextFromTone("warn", "info", "SYNC_SKIPPED_THRESHOLD")).toBe("skipped");
	});

	it("shows capture failed in activity log badge labels", () => {
		const event: SyncEvent = {
			id: "1",
			timestamp: new Date().toISOString(),
			level: "warn",
			code: "CAPTURE_FAILED",
			message: "Could not capture submission: missing preview image",
			commitUrl: null,
		};
		expect(getEventBadgeLabel(event)).toBe("capture failed");
	});
});
