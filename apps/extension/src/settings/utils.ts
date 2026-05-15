import type { SyncEvent } from "../shared/contracts";
import { BRANCH_NAME_PATTERN, EVENT_BADGE_LABELS } from "./constants";

export const getEventBadgeLabel = (event: SyncEvent): string => {
	if (event.code) {
		return (
			EVENT_BADGE_LABELS[event.code] ??
			event.code.toLowerCase().replace(/_/g, " ")
		);
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
