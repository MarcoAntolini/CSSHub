import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleClearActionBadge } from "@/background/handlers/badge";
import { getStoredState, saveStoredState, type StoredState } from "@/storage";
import { STORAGE_KEY, TOKEN_KEY } from "@/storage/authSession";

type MemoryStorageArea = {
	data: Record<string, unknown>;
	get: (key: string) => Promise<Record<string, unknown>>;
	set: (items: Record<string, unknown>) => Promise<void>;
};

const createMemoryStorageArea = (): MemoryStorageArea => {
	const data: Record<string, unknown> = {};
	return {
		data,
		get: async (key: string) => ({ [key]: data[key] }),
		set: async (items: Record<string, unknown>) => {
			Object.assign(data, items);
		},
	};
};

const buildState = (): StoredState => ({
	githubToken: "token",
	auth: {
		isAuthenticated: true,
		username: "player",
		method: "web",
	},
	settings: {
		threshold: 95,
		selectedRepoFullName: "owner/repo",
		selectedBranch: "main",
		systemNotificationsEnabled: true,
		repositoryReadmeMode: "managed-section",
	},
	lastSubmission: null,
	lastSubmissionAccepted: null,
	lastIngestion: null,
	submissionProcessing: true,
	recentEvents: [],
	lastSubmissionFingerprint: null,
	battleMetadataCache: {},
	lastCaptureFailure: null,
});

describe("handleClearActionBadge", () => {
	let local: MemoryStorageArea;
	let session: MemoryStorageArea;

	beforeEach(() => {
		local = createMemoryStorageArea();
		session = createMemoryStorageArea();
		vi.stubGlobal("chrome", {
			action: {
				setBadgeBackgroundColor: vi.fn(),
				setBadgeText: vi.fn(),
				setTitle: vi.fn(),
			},
			storage: {
				local,
				session,
			},
		});
	});

	it("clears processing state and restores the setup badge", async () => {
		await saveStoredState(buildState());
		const sendResponse = vi.fn();

		await handleClearActionBadge(
			{
				action: "clearActionBadge",
			},
			sendResponse,
			{}
		);

		expect(sendResponse).toHaveBeenCalledWith({ ok: true });
		expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
		expect(chrome.action.setTitle).toHaveBeenCalledWith({ title: "CssHub" });

		const state = await getStoredState();
		expect(state.submissionProcessing).toBe(false);
		expect(local.data[STORAGE_KEY]).toBeDefined();
		expect(session.data[TOKEN_KEY]).toBe("token");
	});
});
