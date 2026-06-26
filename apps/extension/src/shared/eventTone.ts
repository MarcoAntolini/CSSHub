import {
	toneFromSyncEventCode,
	type StatusTone,
	type SubmissionIngestionResponse,
	type SyncEvent,
} from "./contracts";

export type { StatusTone };

export const statusTextFromTone = (
	tone: StatusTone,
	neutralLabel = "info",
	eventCode?: string
): string => {
	if (eventCode === "CAPTURE_FAILED") {
		return "capture failed";
	}
	if (tone === "success") return "committed";
	if (tone === "error") return "failed";
	if (tone === "warn") return "skipped";
	return neutralLabel;
};

export const getIngestionTone = (
	ingestion: SubmissionIngestionResponse | null
): StatusTone => {
	if (!ingestion) {
		return "neutral";
	}
	if (ingestion.committed) {
		return "success";
	}
	return toneFromSyncEventCode(ingestion.code);
};

export const getSyncEventTone = (event: SyncEvent): StatusTone => {
	const codeTone = toneFromSyncEventCode(event.code);
	if (codeTone !== "neutral") {
		return codeTone;
	}
	if (event.level === "error") {
		return "error";
	}
	if (event.level === "warn") {
		return "warn";
	}
	return "neutral";
};

export const getEventBadgeLabel = (event: SyncEvent): string => {
	if (event.code) {
		return statusTextFromTone(getSyncEventTone(event), "info", event.code);
	}
	return event.level === "info" ? "info" : event.level;
};
