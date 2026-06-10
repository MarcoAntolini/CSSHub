import {
	toneFromSyncEventCode,
	type StatusTone,
	type SubmissionIngestionResponse,
	type SyncEvent,
} from "./contracts";

export type { StatusTone };

export const statusTextFromTone = (
	tone: StatusTone,
	neutralLabel = "info"
): string => {
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
