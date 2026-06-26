import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAuthState, getStoredState, saveStoredState, type StoredState } from "@/storage";
import { STORAGE_KEY, TOKEN_KEY } from "@/storage/authSession";

type MemoryStorageArea = {
	data: Record<string, unknown>;
	get: (key: string) => Promise<Record<string, unknown>>;
	remove: (key: string) => Promise<void>;
	set: (items: Record<string, unknown>) => Promise<void>;
};

const createMemoryStorageArea = (): MemoryStorageArea => {
	const data: Record<string, unknown> = {};
	return {
		data,
		get: async (key: string) => ({ [key]: data[key] }),
		remove: async (key: string) => {
			delete data[key];
		},
		set: async (items: Record<string, unknown>) => {
			Object.assign(data, items);
		},
	};
};

const buildAuthenticatedState = (): StoredState => ({
	githubToken: "persisted-token",
	auth: {
		isAuthenticated: true,
		username: "oliviermaghe",
		method: "web",
	},
	settings: {
		threshold: 95,
		selectedRepoFullName: "MarcoAntolini/CSSHub",
		selectedBranch: "main",
		systemNotificationsEnabled: true,
		repositoryReadmeMode: "managed-section",
	},
	lastSubmission: null,
	lastSubmissionAccepted: null,
	lastIngestion: null,
	submissionProcessing: false,
	recentEvents: [],
	lastSubmissionFingerprint: null,
	battleMetadataCache: {},
	lastCaptureFailure: null,
});

describe("extension storage auth persistence", () => {
	let local: MemoryStorageArea;
	let session: MemoryStorageArea;

	beforeEach(() => {
		local = createMemoryStorageArea();
		session = createMemoryStorageArea();
		vi.stubGlobal("chrome", {
			storage: {
				local,
				session,
			},
		});
	});

	it("keeps GitHub auth after browser session storage is cleared", async () => {
		await saveStoredState(buildAuthenticatedState());
		for (const key of Object.keys(session.data)) {
			delete session.data[key];
		}

		const state = await getStoredState();
		const persisted = local.data[STORAGE_KEY] as StoredState;

		expect(persisted.githubToken).toBe("persisted-token");
		expect(state.githubToken).toBe("persisted-token");
		expect(state.auth).toEqual({
			isAuthenticated: true,
			username: "oliviermaghe",
			method: "web",
		});
	});

	it("clears the durable GitHub token on explicit disconnect", async () => {
		await saveStoredState(buildAuthenticatedState());

		await clearAuthState();

		const persisted = local.data[STORAGE_KEY] as StoredState;
		expect(persisted.githubToken).toBeNull();
		expect(session.data[TOKEN_KEY]).toBeUndefined();
		expect(persisted.auth).toEqual({
			isAuthenticated: false,
			username: null,
			method: null,
		});
	});

	it("defaults submission processing to false for older stored state", async () => {
		const legacyState = buildAuthenticatedState() as Partial<StoredState>;
		delete legacyState.submissionProcessing;

		await local.set({
			[STORAGE_KEY]: legacyState,
		});

		const state = await getStoredState();

		expect(state.submissionProcessing).toBe(false);
		expect(state.lastCaptureFailure).toBeNull();
	});

	it("parses persisted lastCaptureFailure", async () => {
		await saveStoredState({
			...buildAuthenticatedState(),
			lastCaptureFailure: {
				timestamp: "2026-06-23T17:00:00.000Z",
				challengeId: "42",
				issueIds: ["preview-image"],
				reason: "Could not capture submission: missing preview image",
				code: "CAPTURE_FAILED",
			},
		});

		const state = await getStoredState();
		expect(state.lastCaptureFailure?.challengeId).toBe("42");
	});
});
