import type { SubmissionPayload } from "@/shared/contracts";

export const BATTLE_SUBMISSION_JSON =
	/^Battles\/([^/]+)\/([^/]+)\/submission\.json$/;
export const DAILY_SUBMISSION_JSON = /^Daily Targets\/([^/]+)\/submission\.json$/;
export const LEGACY_SUBMISSION_JSON = /^challenges\/([^/]+)\/submission\.json$/;

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

export const challengeIdentityKey = (payload: SubmissionPayload): string => {
	if (payload.challengeMode === "daily" && payload.dailyDateIso) {
		return `daily:${payload.dailyDateIso}`;
	}
	if (
		payload.challengeMode === "battle" &&
		payload.battleGroup &&
		payload.challengeLabel
	) {
		return `battle:${payload.battleGroup}:${payload.challengeLabel}`;
	}
	return `id:${payload.challengeId}`;
};

export const challengeStorageKey = (payload: SubmissionPayload): string => {
	if (payload.challengeMode === "daily" && payload.dailyDateIso) {
		return payload.dailyDateIso;
	}

	if (payload.challengeMode === "battle" && payload.battleGroup && payload.challengeLabel) {
		return `${payload.battleGroup}/${payload.challengeLabel}`;
	}

	const rawId = payload.challengeId.trim().toLowerCase();
	if (/^\d+$/.test(rawId)) {
		return rawId;
	}
	if (rawId && rawId !== "unknown") {
		const normalized = rawId
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "");
		if (normalized) {
			return normalized;
		}
	}
	const fallback = slugify(payload.challengeName);
	return fallback ? `unknown-${fallback}` : "unknown";
};

export const challengeFolderPath = (payload: SubmissionPayload): string => {
	if (payload.challengeMode === "daily" && payload.dailyDateIso) {
		return `Daily Targets/${payload.dailyDateIso}`;
	}
	if (payload.challengeMode === "battle" && payload.battleGroup && payload.challengeLabel) {
		return `Battles/${payload.battleGroup}/${payload.challengeLabel}`;
	}
	return `challenges/${challengeStorageKey(payload)}`;
};

export const submissionMetadataPath = (folder: string): string => `${folder}/submission.json`;

const legacyNumericSubmissionPath = (payload: SubmissionPayload): string | null => {
	const rawId = payload.challengeId.trim();
	if (/^\d+$/.test(rawId)) {
		return submissionMetadataPath(`challenges/${rawId}`);
	}
	return null;
};

const legacySlugSubmissionPath = (payload: SubmissionPayload): string =>
	submissionMetadataPath(
		`challenges/${slugify(`${payload.challengeId}-${payload.challengeName}`)}`
	);

export const listBestSubmissionMetadataPaths = (payload: SubmissionPayload): string[] => {
	const paths = [submissionMetadataPath(challengeFolderPath(payload))];
	const legacyNumeric = legacyNumericSubmissionPath(payload);
	if (legacyNumeric) {
		paths.push(legacyNumeric);
	}
	paths.push(legacySlugSubmissionPath(payload));
	return paths;
};

export const formatChallengeTitle = (payload: SubmissionPayload): string => {
	if (payload.challengeMode === "daily" && payload.dailyDateLabel) {
		return `Daily Target — ${payload.dailyDateLabel}`;
	}
	if (payload.challengeMode === "battle" && payload.challengeLabel) {
		return payload.challengeLabel;
	}
	if (payload.challengeId === "unknown") {
		return payload.challengeName;
	}
	return `Target ${payload.challengeId}: ${payload.challengeName}`;
};

export const folderFromSubmissionJsonPath = (
	path: string
): { kind: "battle" | "daily" | "legacy"; folder: string; label: string } | null => {
	const battleMatch = path.match(BATTLE_SUBMISSION_JSON);
	if (battleMatch) {
		return {
			kind: "battle",
			folder: `Battles/${battleMatch[1]}/${battleMatch[2]}`,
			label: battleMatch[2],
		};
	}
	const dailyMatch = path.match(DAILY_SUBMISSION_JSON);
	if (dailyMatch) {
		return {
			kind: "daily",
			folder: `Daily Targets/${dailyMatch[1]}`,
			label: dailyMatch[1],
		};
	}
	const legacyMatch = path.match(LEGACY_SUBMISSION_JSON);
	if (legacyMatch) {
		return {
			kind: "legacy",
			folder: `challenges/${legacyMatch[1]}`,
			label: legacyMatch[1],
		};
	}
	return null;
};
