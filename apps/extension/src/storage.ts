import {
	submissionPayloadSchema,
	submissionIngestionResponseSchema,
	syncEventSchema,
	type AuthStatus,
} from "./shared/contracts";
import type { CssbattleBattleMetadataCache } from "./cssbattleBattleMetadata";
import {
	parseAuthFromLocal,
	reconcileAuthWithSession,
} from "./storage/authSession";
import {
	clearSessionToken,
	readPersistedState,
	writePersistedState,
} from "./storage/persistence";
import { defaultSettings, parseStoredSettings } from "./storage/settingsMigration";
import type { StoredState } from "./storage/types";

export type { StoredState } from "./storage/types";

const buildDefaultState = (sessionToken: string | null): StoredState => ({
	githubToken: sessionToken,
	auth: {
		isAuthenticated: false,
		username: null,
		method: null,
	},
	settings: defaultSettings(),
	lastSubmission: null,
	lastSubmissionAccepted: null,
	lastIngestion: null,
	recentEvents: [],
	lastSubmissionFingerprint: null,
	battleMetadataCache: {},
});

const parseBattleMetadataCache = (value: unknown): CssbattleBattleMetadataCache => {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	const cache: CssbattleBattleMetadataCache = {};
	for (const [battleId, metadata] of Object.entries(value)) {
		if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
			continue;
		}
		const record = metadata as Record<string, unknown>;
		const totalChallenges = record.totalChallenges;
		const status = record.status;
		const fetchedAt = record.fetchedAt;
		if (
			typeof record.battleId !== "string" ||
			(totalChallenges !== null &&
				!(typeof totalChallenges === "number" && Number.isInteger(totalChallenges))) ||
			(status !== "finished" && status !== "unfinished") ||
			typeof fetchedAt !== "string"
		) {
			continue;
		}
		cache[battleId] = {
			battleId: record.battleId,
			totalChallenges,
			status,
			fetchedAt,
		};
	}
	return cache;
};

export const getStoredState = async (): Promise<StoredState> => {
	const { local: state, sessionToken } = await readPersistedState();

	if (!state) {
		return buildDefaultState(sessionToken);
	}

	const settings = parseStoredSettings(state.settings);
	const lastSubmission = submissionPayloadSchema.safeParse(state.lastSubmission);
	const lastIngestion = submissionIngestionResponseSchema.safeParse(state.lastIngestion);
	const recentEvents = syncEventSchema.array().safeParse(state.recentEvents);

	const hasSessionToken = Boolean(sessionToken);
	const authFromLocal = parseAuthFromLocal(state.auth);
	const auth: AuthStatus = reconcileAuthWithSession(authFromLocal, hasSessionToken);

	const next: StoredState = {
		githubToken: sessionToken,
		auth,
		settings,
		lastSubmission: lastSubmission.success ? lastSubmission.data : null,
		lastSubmissionAccepted:
			typeof state.lastSubmissionAccepted === "boolean"
				? state.lastSubmissionAccepted
				: null,
		lastIngestion: lastIngestion.success ? lastIngestion.data : null,
		recentEvents: recentEvents.success ? recentEvents.data : [],
		lastSubmissionFingerprint:
			typeof state.lastSubmissionFingerprint === "string"
				? state.lastSubmissionFingerprint
				: null,
		battleMetadataCache: parseBattleMetadataCache(state.battleMetadataCache),
	};

	if (!hasSessionToken && authFromLocal.isAuthenticated) {
		void saveStoredState(next).catch(() => {
			/* ignore persistence failures */
		});
	}

	return next;
};

export const saveStoredState = async (state: StoredState): Promise<void> => {
	await writePersistedState(state);
};

export const clearAuthState = async (): Promise<StoredState> => {
	const current = await getStoredState();
	const next: StoredState = {
		...current,
		githubToken: null,
		auth: {
			isAuthenticated: false,
			username: null,
			method: null,
		},
	};
	await saveStoredState(next);
	await clearSessionToken();
	return next;
};

export const clearRecentEvents = async (): Promise<StoredState> => {
	const current = await getStoredState();
	const next: StoredState = {
		...current,
		recentEvents: [],
	};
	await saveStoredState(next);
	return next;
};
