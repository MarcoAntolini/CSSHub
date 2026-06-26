import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCaptureAttemptFailed } from "@/background/handlers/captureFailure";
import { clearRecentEvents, getStoredState, saveStoredState, type StoredState } from "@/storage";
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

describe("handleCaptureAttemptFailed", () => {
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
			notifications: {
				create: vi.fn((_id, _opts, cb) => cb?.("id")),
				clear: vi.fn(),
				onClicked: { addListener: vi.fn() },
				onButtonClicked: { addListener: vi.fn() },
				onClosed: { addListener: vi.fn() },
			},
			storage: {
				local,
				session,
			},
		});
	});

	it("sets FAIL badge, lastCaptureFailure, and appends activity log events", async () => {
		await saveStoredState(buildState());
		const sendResponse = vi.fn();

		await handleCaptureAttemptFailed(
			{
				action: "captureAttemptFailed",
				issueIds: ["preview-image"],
				reason: "Could not capture submission: missing preview image",
				challengeId: "42",
				challengeName: "Target 1",
			},
			sendResponse,
			{}
		);

		expect(sendResponse).toHaveBeenCalledWith({ ok: true });
		expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "FAIL" });
		expect(chrome.notifications.create).toHaveBeenCalled();

		const state = await getStoredState();
		expect(state.submissionProcessing).toBe(false);
		expect(state.lastCaptureFailure?.issueIds).toEqual(["preview-image"]);
		expect(state.lastCaptureFailure?.code).toBe("CAPTURE_FAILED");
		expect(state.recentEvents).toHaveLength(1);
		expect(state.recentEvents[0]?.code).toBe("CAPTURE_FAILED");
	});

	it("logs each repeated failure without dedupe", async () => {
		await saveStoredState(buildState());
		const sendResponse = vi.fn();

		await handleCaptureAttemptFailed(
			{
				action: "captureAttemptFailed",
				issueIds: ["editor-code"],
				reason: "Could not capture submission: missing editor code",
			},
			sendResponse,
			{}
		);
		await handleCaptureAttemptFailed(
			{
				action: "captureAttemptFailed",
				issueIds: ["target-image"],
				reason: "Could not capture submission: missing target image",
			},
			sendResponse,
			{}
		);

		const state = await getStoredState();
		expect(state.recentEvents).toHaveLength(2);
		expect(state.lastCaptureFailure?.issueIds).toEqual(["target-image"]);
	});

	it("clearRecentEvents does not clear lastCaptureFailure", async () => {
		await saveStoredState({
			...buildState(),
			lastCaptureFailure: {
				timestamp: new Date().toISOString(),
				issueIds: ["preview-image"],
				reason: "Could not capture submission: missing preview image",
				code: "CAPTURE_FAILED",
			},
			recentEvents: [
				{
					id: "1",
					timestamp: new Date().toISOString(),
					level: "warn",
					code: "CAPTURE_FAILED",
					message: "Could not capture submission: missing preview image",
					commitUrl: null,
				},
			],
		});

		await clearRecentEvents();
		const state = await getStoredState();
		expect(state.recentEvents).toEqual([]);
		expect(state.lastCaptureFailure?.code).toBe("CAPTURE_FAILED");
		expect(local.data[STORAGE_KEY]).toBeDefined();
		expect(session.data[TOKEN_KEY]).toBe("token");
	});
});
