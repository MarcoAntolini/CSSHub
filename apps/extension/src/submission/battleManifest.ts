import { z } from "zod";

import type { BattleStatus, SubmissionPayload } from "@/shared/contracts";

export const BATTLE_MANIFEST_SCHEMA_VERSION = 1;

export type BattleManifest = {
	schemaVersion: typeof BATTLE_MANIFEST_SCHEMA_VERSION;
	battleId: string | null;
	battleGroup: string;
	totalTargets: number;
	status: BattleStatus;
	fetchedAt: string;
	lastUpdatedFromTarget: string | null;
};

const battleManifestSchema = z.object({
	schemaVersion: z.literal(BATTLE_MANIFEST_SCHEMA_VERSION),
	battleId: z.string().min(1).nullable(),
	battleGroup: z.string().min(1),
	totalTargets: z.number().int().positive(),
	status: z.enum(["finished", "unfinished"]),
	fetchedAt: z.string().min(1),
	lastUpdatedFromTarget: z.string().min(1).nullable(),
});

export const BATTLE_MANIFEST_JSON = /^Battles\/([^/]+)\/battle\.json$/;

export const battleManifestPathFromGroup = (battleGroup: string): string =>
	`Battles/${battleGroup}/battle.json`;

export const battleManifestGroupFromPath = (path: string): string | null =>
	path.match(BATTLE_MANIFEST_JSON)?.[1] ?? null;

export const buildBattleManifestFromPayload = (
	payload: SubmissionPayload
): BattleManifest | null => {
	if (
		payload.challengeMode !== "battle" ||
		!payload.battleGroup ||
		typeof payload.battleTotalChallenges !== "number" ||
		!Number.isInteger(payload.battleTotalChallenges) ||
		payload.battleTotalChallenges <= 0 ||
		(payload.battleStatus !== "finished" && payload.battleStatus !== "unfinished")
	) {
		return null;
	}

	return {
		schemaVersion: BATTLE_MANIFEST_SCHEMA_VERSION,
		battleId: payload.battleId ?? null,
		battleGroup: payload.battleGroup,
		totalTargets: payload.battleTotalChallenges,
		status: payload.battleStatus,
		fetchedAt: payload.submittedAt,
		lastUpdatedFromTarget: payload.challengeLabel ?? null,
	};
};

export const parseBattleManifest = (content: string | null): BattleManifest | null => {
	if (!content) {
		return null;
	}
	try {
		const parsed = battleManifestSchema.safeParse(JSON.parse(content));
		return parsed.success ? parsed.data : null;
	} catch (_error) {
		return null;
	}
};

export const mergeBattleManifest = (
	current: BattleManifest | null,
	next: BattleManifest | null
): BattleManifest | null => {
	if (!current) {
		return next;
	}
	if (!next) {
		return current;
	}
	if (current.status === "finished") {
		return current;
	}
	if (next.status === "finished") {
		return next;
	}
	return next.totalTargets >= current.totalTargets ? next : current;
};
