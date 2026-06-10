import type { SyncEvent } from "@/shared/contracts";
import { getSyncEventTone, statusTextFromTone } from "@/shared/eventTone";
import { BRANCH_NAME_PATTERN } from "./constants";

export const getEventBadgeLabel = (event: SyncEvent): string => {
	if (event.code) {
		return statusTextFromTone(getSyncEventTone(event));
	}
	return event.level === "info" ? "info" : event.level;
};

export const formatActivityTimestamp = (iso: string): string => {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) {
		return iso;
	}
	return d.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

export const validateBranchName = (
	value: string,
	existingBranchNames: Set<string>
): string | null => {
	if (!value) {
		return "Branch name required";
	}
	if (!BRANCH_NAME_PATTERN.test(value)) {
		return "Use only letters, numbers, dot, underscore, slash, and dash";
	}
	if (
		value.includes("..") ||
		value.includes("//") ||
		value.startsWith("/") ||
		value.endsWith("/") ||
		value.startsWith(".") ||
		value.endsWith(".") ||
		value.endsWith(".lock")
	) {
		return "Invalid branch format";
	}
	if (existingBranchNames.has(value)) {
		return "Branch already exists";
	}
	return null;
};
