import type { BackgroundEventCode, SyncEvent } from "@/shared/contracts";

export const MAX_RECENT_EVENTS = 15;

export const pushSyncEvent = (
	events: SyncEvent[],
	level: SyncEvent["level"],
	message: string,
	commitUrl: string | null = null,
	code?: BackgroundEventCode
): SyncEvent[] => {
	const next: SyncEvent = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		level,
		code,
		message,
		commitUrl,
	};
	return [next, ...events].slice(0, MAX_RECENT_EVENTS);
};
