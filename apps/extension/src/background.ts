import {
	extensionStateResponseSchema,
	elementDimensionsSchema,
	popupToBackgroundMessageSchema,
	submissionIngestionResponseSchema,
	type PopupToBackgroundMessage,
	type SubmissionIngestionResponse,
	type SyncEvent,
	type SubmissionPayload,
	type Repo,
	type Branch,
	type ElementDimensions,
} from "./shared/contracts";
import {
	buildGithubAuthorizeUrl,
	exchangeWebAuthCode,
	requestWebOAuthState,
	startDeviceFlow,
	pollDeviceFlow,
} from "./githubAuth";
import {
	createUserRepo,
	createBranch,
	commitFilesToRepo,
	fetchAuthenticatedUser,
	fetchRepoUtf8File,
	getSavedSubmissionMetrics,
	listBranchBlobPaths,
	listBranches,
	listUserRepos,
	type CommitFile,
	type SavedSubmissionMetrics,
} from "./githubClient";
import {
	clearAuthState,
	clearRecentEvents,
	getStoredState,
	saveStoredState,
} from "./storage";
import { buildRootReadmeContent } from "./rootReadme";

const toBase64 = (bytes: Uint8Array): string => {
	let output = "";
	for (const value of bytes) {
		output += String.fromCharCode(value);
	}
	return btoa(output);
};

const cropImageDataUrl = async (
	dataUrl: string,
	dimensions: ElementDimensions
): Promise<string> => {
	const sourceBlob = await (await fetch(dataUrl)).blob();
	const bitmap = await createImageBitmap(sourceBlob);
	const canvas = new OffscreenCanvas(dimensions.width, dimensions.height);
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Unable to create canvas context");
	}

	context.drawImage(
		bitmap,
		dimensions.x,
		dimensions.y,
		dimensions.width,
		dimensions.height,
		0,
		0,
		dimensions.width,
		dimensions.height
	);

	const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
	const bytes = new Uint8Array(await croppedBlob.arrayBuffer());
	return `data:image/png;base64,${toBase64(bytes)}`;
};

const captureElement = async (
	_dimensions: ElementDimensions
): Promise<string> => {
	return new Promise((resolve, reject) => {
		chrome.tabs.captureVisibleTab({ format: "png" }, async (dataUrl) => {
			try {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message));
					return;
				}
				if (!dataUrl) {
					reject(new Error("Capture failed"));
					return;
				}
				const croppedDataUrl = await cropImageDataUrl(dataUrl, _dimensions);
				resolve(croppedDataUrl);
			} catch (error) {
				reject(error);
			}
		});
	});
};

const CONTENT_SCRIPT_FILE = "contentScript.js";
const RECEIVING_END_MISSING = "Receiving end does not exist";

const isCssBattlePlayUrl = (url: string | undefined): boolean => {
	if (!url) {
		return false;
	}

	try {
		const parsed = new URL(url);
		return (
			(parsed.hostname === "cssbattle.dev" ||
				parsed.hostname === "www.cssbattle.dev") &&
			parsed.pathname.startsWith("/play/")
		);
	} catch (_error) {
		return false;
	}
};

const queryActiveTab = async (): Promise<chrome.tabs.Tab | null> =>
	new Promise((resolve) => {
		chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
			resolve(tabs[0] ?? null);
		});
	});

const injectContentScript = async (tabId: number): Promise<void> =>
	new Promise((resolve, reject) => {
		chrome.scripting.executeScript(
			{
				target: { tabId },
				files: [CONTENT_SCRIPT_FILE],
			},
			() => {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message));
					return;
				}
				resolve();
			}
		);
	});

const getElementDimensionsFromTab = async (
	tabId: number,
	selector: string
): Promise<ElementDimensions> =>
	new Promise((resolve, reject) => {
		chrome.tabs.sendMessage(
			tabId,
			{
				action: "getElementPositionAndDimensions",
				selector,
			},
			(response) => {
				const lastError = chrome.runtime.lastError;
				if (lastError) {
					reject(new Error(lastError.message));
					return;
				}

				const dimensions = elementDimensionsSchema.safeParse(response);
				if (!dimensions.success) {
					reject(new Error("Could not find capture area"));
					return;
				}

				resolve(dimensions.data);
			}
		);
	});

const slugify = (value: string): string => {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);
};

const challengeStorageKey = (payload: SubmissionPayload): string => {
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

const challengeFolderPath = (payload: SubmissionPayload): string =>
	`challenges/${challengeStorageKey(payload)}`;

const submissionMetadataPath = (payload: SubmissionPayload): string =>
	`${challengeFolderPath(payload)}/submission.json`;

const legacySubmissionMetadataPath = (payload: SubmissionPayload): string => {
	const legacySlug = slugify(`${payload.challengeId}-${payload.challengeName}`);
	return `challenges/${legacySlug}/submission.json`;
};

const readBestSubmissionMetrics = async (
	token: string,
	repoFullName: string,
	branch: string,
	payload: SubmissionPayload
): Promise<SavedSubmissionMetrics | null> => {
	const primary = await getSavedSubmissionMetrics(
		token,
		repoFullName,
		branch,
		submissionMetadataPath(payload)
	);
	if (primary) {
		return primary;
	}
	return getSavedSubmissionMetrics(
		token,
		repoFullName,
		branch,
		legacySubmissionMetadataPath(payload)
	);
};

const getBase64FromDataUrl = (dataUrl: string): string => {
	const base64 = dataUrl.split(",")[1];
	if (!base64) {
		throw new Error("Invalid data URL");
	}
	return base64;
};

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const getMarkdownFence = (content: string): string => {
	let fence = "```";
	while (content.includes(fence)) {
		fence += "`";
	}
	return fence;
};

const formatChallengeTitle = (payload: SubmissionPayload): string => {
	if (payload.challengeId === "unknown") {
		return payload.challengeName;
	}
	return `Target ${payload.challengeId}: ${payload.challengeName}`;
};

const getChallengeUrl = (payload: SubmissionPayload): string =>
	payload.challengeUrl ??
	`https://cssbattle.dev/play/${encodeURIComponent(payload.challengeId)}`;

const formatSubmissionMetric = (value: number | null, suffix = ""): string =>
	value === null ? "Not available" : `${value}${suffix}`;

const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			return null;
		}

		const bytes = new Uint8Array(await response.arrayBuffer());
		return toBase64(bytes);
	} catch (_error) {
		return null;
	}
};

const buildReadme = (
	payload: SubmissionPayload,
	hasUserImage: boolean,
	hasTargetImage: boolean
): string => {
	const title = formatChallengeTitle(payload);
	const escapedTitle = escapeHtml(title);
	const challengeUrl = getChallengeUrl(payload);
	const userCell = hasUserImage
		? `<img src="./user.png" alt="User Submission" width="100%">`
		: "Not available";
	const targetCell = hasTargetImage
		? `<img src="./target.png" alt="Target" width="100%">`
		: "Not available";
	const code = payload.code || "<!-- empty submission -->";
	const fence = getMarkdownFence(code);

	return `# ${title}

Challenge: <${challengeUrl}>

## Result

<table>
	<tr>
		<th width="50%">User Submission</th>
		<th width="50%">Target</th>
	</tr>
	<tr>
		<td width="50%" align="center">
			${userCell}
		</td>
		<td width="50%" align="center">
			${targetCell}
		</td>
	</tr>
</table>

## Code

${fence}html
${code}
${fence}

## Submission Data

- Challenge: ${escapedTitle}
- Score: ${formatSubmissionMetric(payload.score)}
- Match: ${formatSubmissionMetric(payload.matchPct, "%")}
- Submitted at: ${payload.submittedAt}
`;
};

const buildSubmissionFiles = async (
	payload: SubmissionPayload
): Promise<CommitFile[]> => {
	const folder = challengeFolderPath(payload);
	const files: CommitFile[] = [];

	files.push(
		{ path: `${folder}/solution.html`, delete: true },
		{ path: `${folder}/result.png`, delete: true },
		{ path: `${folder}/target.url.txt`, delete: true }
	);

	const metadata = {
		challengeId: payload.challengeId,
		challengeName: payload.challengeName,
		challengeUrl: getChallengeUrl(payload),
		submittedAt: payload.submittedAt,
		score: payload.score,
		matchPct: payload.matchPct,
	};
	files.push({
		path: `${folder}/submission.json`,
		content: JSON.stringify(metadata, null, 2),
		encoding: "utf-8",
	});

	if (payload.resultImageDataUrl) {
		files.push({
			path: `${folder}/user.png`,
			content: getBase64FromDataUrl(payload.resultImageDataUrl),
			encoding: "base64",
		});
	}

	let hasTargetImage = false;
	if (payload.targetImage?.type === "dataUrl") {
		files.push({
			path: `${folder}/target.png`,
			content: getBase64FromDataUrl(payload.targetImage.value),
			encoding: "base64",
		});
		hasTargetImage = true;
	}

	if (payload.targetImage?.type === "url") {
		const targetImageBase64 = await fetchImageAsBase64(payload.targetImage.value);
		if (targetImageBase64) {
			files.push({
				path: `${folder}/target.png`,
				content: targetImageBase64,
				encoding: "base64",
			});
			hasTargetImage = true;
		}
	}

	files.unshift({
		path: `${folder}/README.md`,
		content: buildReadme(payload, Boolean(payload.resultImageDataUrl), hasTargetImage),
		encoding: "utf-8",
	});

	return files;
};

const formatCommitMessage = (
	score: number | null,
	matchPct: number | null
): string => {
	const scoreValue = score ?? 0;
	const matchValue = (matchPct ?? 0).toFixed(2);
	return `Score: ${scoreValue} (${matchValue}% match) - CSSHub`;
};

const DUPLICATE_WINDOW_MS = 45 * 1000;
const DUPLICATE_WINDOW_SECONDS = Math.floor(DUPLICATE_WINDOW_MS / 1000);
const MAX_EVENTS = 15;
const MAX_REASONABLE_SCORE = 100_000;
const BADGE_CLEAR_TIMEOUT_MS = 10_000;
type SyncEventCode =
	| "SYNC_COMMITTED"
	| "SYNC_SKIPPED_DUPLICATE"
	| "SYNC_SKIPPED_THRESHOLD"
	| "SYNC_SKIPPED_NOT_IMPROVED"
	| "SYNC_SKIPPED_INVALID_SCORE"
	| "SYNC_AUTH_REQUIRED"
	| "SYNC_REPO_REQUIRED"
	| "AUTH_STATE_MISMATCH"
	| "AUTH_OAUTH_CODE_MISSING"
	| "AUTH_GITHUB_UNAUTHORIZED"
	| "GITHUB_NOT_FOUND"
	| "GITHUB_CONFLICT"
	| "GITHUB_RATE_LIMIT"
	| "GITHUB_UNAVAILABLE"
	| "NETWORK_ERROR"
	| "UNEXPECTED_ERROR";

type FeedbackLevel = "success" | "warn" | "error";

const setActionBadge = (level: FeedbackLevel, text: string): void => {
	const bg =
		level === "success"
			? "#15803d"
			: level === "warn"
			? "#b45309"
			: "#b91c1c";
	chrome.action.setBadgeBackgroundColor({ color: bg });
	chrome.action.setBadgeText({ text });
	setTimeout(() => {
		chrome.action.setBadgeText({ text: "" });
	}, BADGE_CLEAR_TIMEOUT_MS);
};

const showBrowserNotification = (
	enabled: boolean,
	level: FeedbackLevel,
	title: string,
	message: string
): void => {
	if (!enabled || !chrome.notifications) {
		return;
	}
	const iconUrl =
		level === "success"
			? "icons/icon_48.png"
			: level === "warn"
			? "icons/icon_48.png"
			: "icons/icon_48.png";
	void chrome.notifications.create({
		type: "basic",
		title,
		message,
		iconUrl,
		priority: level === "error" ? 2 : 1,
	});
};

const parseGithubStatus = (message: string): number | null => {
	const matched = message.match(/GitHub request failed \((\d{3})\)/);
	if (!matched) {
		return null;
	}
	const status = Number(matched[1]);
	return Number.isFinite(status) ? status : null;
};

const getRawErrorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : "Unexpected background failure";

const toUserSafeError = (
	error: unknown
): { message: string; code: SyncEventCode } => {
	const rawMessage = getRawErrorMessage(error);
	const githubStatus = parseGithubStatus(rawMessage);

	if (rawMessage.includes("OAuth state mismatch")) {
		return {
			message: "GitHub login validation failed. Please try again.",
			code: "AUTH_STATE_MISMATCH",
		};
	}
	if (rawMessage.includes("Missing OAuth authorization code")) {
		return {
			message: "GitHub login did not return an authorization code.",
			code: "AUTH_OAUTH_CODE_MISSING",
		};
	}
	if (githubStatus === 401 || githubStatus === 403) {
		return {
			message: "GitHub authentication failed. Reconnect your account.",
			code: "AUTH_GITHUB_UNAUTHORIZED",
		};
	}
	if (githubStatus === 404) {
		return {
			message: "Repository or branch not found. Verify repository settings.",
			code: "GITHUB_NOT_FOUND",
		};
	}
	if (githubStatus === 409 || githubStatus === 422) {
		return {
			message: "GitHub rejected this operation. Check repository and branch.",
			code: "GITHUB_CONFLICT",
		};
	}
	if (githubStatus === 429) {
		return {
			message: "GitHub rate limit reached. Retry in a few minutes.",
			code: "GITHUB_RATE_LIMIT",
		};
	}
	if (githubStatus !== null && githubStatus >= 500) {
		return {
			message: "GitHub is temporarily unavailable. Try again shortly.",
			code: "GITHUB_UNAVAILABLE",
		};
	}
	if (
		rawMessage.includes("Failed to fetch") ||
		rawMessage.includes("NetworkError")
	) {
		return {
			message: "Network error while contacting GitHub services.",
			code: "NETWORK_ERROR",
		};
	}

	return {
		message: "Operation failed. Check settings and try again.",
		code: "UNEXPECTED_ERROR",
	};
};

const pushEvent = (
	events: SyncEvent[],
	level: SyncEvent["level"],
	message: string,
	commitUrl: string | null = null,
	code?: SyncEventCode
): SyncEvent[] => {
	const next: SyncEvent = {
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
		level,
		code,
		message,
		commitUrl,
	};
	return [next, ...events].slice(0, MAX_EVENTS);
};

const fingerprintSubmission = (payload: SubmissionPayload): string => {
	const compact = JSON.stringify({
		challengeId: payload.challengeId,
		score: payload.score,
		matchPct: payload.matchPct,
		code: payload.code,
	});
	let hash = 0;
	for (let index = 0; index < compact.length; index += 1) {
		hash = (hash << 5) - hash + compact.charCodeAt(index);
		hash |= 0;
	}
	return String(hash);
};

const isDuplicateSubmission = (
	payload: SubmissionPayload,
	lastSubmission: SubmissionPayload | null,
	lastFingerprint: string | null
): boolean => {
	if (!lastSubmission || !lastFingerprint) {
		return false;
	}
	const currentFingerprint = fingerprintSubmission(payload);
	if (currentFingerprint !== lastFingerprint) {
		return false;
	}
	const now = Date.parse(payload.submittedAt);
	const before = Date.parse(lastSubmission.submittedAt);
	if (Number.isNaN(now) || Number.isNaN(before)) {
		return false;
	}
	return now - before <= DUPLICATE_WINDOW_MS;
};

const duplicateReasonMessage = (): string =>
	`Duplicate submission skipped: same challenge, code, and score within ${DUPLICATE_WINDOW_SECONDS}s window.`;

const isImprovedSubmission = (
	current: SavedSubmissionMetrics,
	previous: SavedSubmissionMetrics
): boolean => {
	if (current.matchPct > previous.matchPct) {
		return true;
	}
	if (current.matchPct < previous.matchPct) {
		return false;
	}
	return current.score > previous.score;
};

const formatSubmissionLine = (m: SavedSubmissionMetrics): string =>
	`${m.matchPct.toFixed(2)}% match · ${m.score} score`;

const notImprovedReasonMessage = (
	current: SavedSubmissionMetrics,
	previous: SavedSubmissionMetrics
): string => {
	const best = formatSubmissionLine(previous);
	const now = formatSubmissionLine(current);
	if (current.matchPct === previous.matchPct && current.score === previous.score) {
		return `Repository left unchanged: this run matches your best on this branch (${best}). Only a strictly better match % or score triggers a new commit.`;
	}
	return `Repository left unchanged: best on this branch is ${best}. This run was ${now}, which is not an improvement.`;
};

const hasPositiveLastScore = (payload: SubmissionPayload): boolean =>
	typeof payload.score === "number" &&
	Number.isFinite(payload.score) &&
	payload.score > 0 &&
	payload.score <= MAX_REASONABLE_SCORE &&
	typeof payload.matchPct === "number" &&
	Number.isFinite(payload.matchPct) &&
	payload.matchPct > 0;

type MessageResponse = { ok: boolean; data?: unknown; error?: string };
type SendResponse = (response: MessageResponse) => void;
type Handler<TAction extends PopupToBackgroundMessage["action"]> = (
	data: Extract<PopupToBackgroundMessage, { action: TAction }>,
	sendResponse: SendResponse,
	sender: chrome.runtime.MessageSender
) => Promise<void>;

/** Serialized into the page MAIN world; must stay self-contained for `executeScript`. */
function readCodeMirror6DocumentFromPage(): string | null {
	const root = document.querySelector(".cm-editor .cm-content, .cm-content");
	if (!(root instanceof HTMLElement)) {
		return null;
	}
	const tile = (root as HTMLElement & { cmTile?: { view?: { state?: { doc?: { toString(): string } } } } })
		.cmTile;
	const doc = tile?.view?.state?.doc;
	if (doc && typeof doc.toString === "function") {
		return doc.toString();
	}
	return null;
}

const handleExtractCssbattleEditorCode: Handler<"extractCssbattleEditorCode"> = async (
	_data,
	sendResponse,
	sender
) => {
	const tab = sender.tab;
	const tabId = tab?.id;
	if (!tabId || !isCssBattlePlayUrl(tab.url)) {
		sendResponse({ ok: false, error: "No CSSBattle play tab" });
		return;
	}

	try {
		const [injectionResult] = await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: readCodeMirror6DocumentFromPage,
		});
		const raw = injectionResult?.result;
		const code = typeof raw === "string" ? raw : null;
		sendResponse({ ok: true, data: { code } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Editor read failed";
		sendResponse({ ok: false, error: message });
	}
};

const handleCaptureElement: Handler<"captureElement"> = async (
	data,
	sendResponse,
	sender
) => {
	const tab = sender.tab ?? (await queryActiveTab());
	if (!tab?.id) {
		sendResponse({ ok: false, error: "No active tab found" });
		return;
	}

	try {
		let dimensions: ElementDimensions;
		try {
			dimensions = await getElementDimensionsFromTab(tab.id, data.selector);
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			if (
				!message.includes(RECEIVING_END_MISSING) ||
				!isCssBattlePlayUrl(tab.url)
			) {
				throw error;
			}

			await injectContentScript(tab.id);
			dimensions = await getElementDimensionsFromTab(tab.id, data.selector);
		}

		const croppedDataUrl = await captureElement(dimensions);
		sendResponse({ ok: true, data: { croppedDataUrl } });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Capture failed";
		sendResponse({ ok: false, error: message });
	}
};

const handleGetExtensionState: Handler<"getExtensionState"> = async (
	_data,
	sendResponse
) => {
	const state = await getStoredState();
	let repos: Repo[] = [];
	if (state.githubToken) {
		try {
			repos = await listUserRepos(state.githubToken);
		} catch (_error) {
			repos = [];
		}
	}

	const payload = extensionStateResponseSchema.parse({
		auth: state.auth,
		settings: state.settings,
		repos,
		lastSubmission: state.lastSubmission,
		lastSubmissionAccepted: state.lastSubmissionAccepted,
		lastIngestion: state.lastIngestion,
		recentEvents: state.recentEvents,
	});

	sendResponse({ ok: true, data: payload });
};

const handleSaveSettings: Handler<"saveSettings"> = async (data, sendResponse) => {
	const state = await getStoredState();
	await saveStoredState({
		...state,
		settings: data.settings,
	});
	sendResponse({ ok: true });
};

const handleStartGithubDeviceFlow: Handler<"startGithubDeviceFlow"> = async (
	_data,
	sendResponse
) => {
	const device = await startDeviceFlow();
	sendResponse({ ok: true, data: device });
};

const handlePollGithubDeviceFlow: Handler<"pollGithubDeviceFlow"> = async (
	data,
	sendResponse
) => {
	const accessToken = await pollDeviceFlow(data.deviceCode);
	if (!accessToken) {
		sendResponse({
			ok: true,
			data: { status: "pending" },
		});
		return;
	}

	const username = await fetchAuthenticatedUser(accessToken);
	const state = await getStoredState();
	await saveStoredState({
		...state,
		githubToken: accessToken,
		auth: {
			isAuthenticated: true,
			username,
			method: "device",
		},
	});

	sendResponse({
		ok: true,
		data: { status: "authenticated", username },
	});
};

const runLaunchWebAuthFlow = async (url: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		chrome.identity.launchWebAuthFlow(
			{
				url,
				interactive: true,
			},
			(redirectedTo) => {
				const error = chrome.runtime.lastError;
				if (error) {
					reject(new Error(error.message));
					return;
				}
				if (!redirectedTo) {
					reject(new Error("OAuth web flow was cancelled"));
					return;
				}
				resolve(redirectedTo);
			}
		);
	});
};

const handleStartGithubWebFlow: Handler<"startGithubWebFlow"> = async (
	_data,
	sendResponse
) => {
	const redirectUri = chrome.identity.getRedirectURL("github");
	const { state, githubClientId } = await requestWebOAuthState();
	const authUrl = buildGithubAuthorizeUrl(githubClientId, redirectUri, state);
	const redirectedTo = await runLaunchWebAuthFlow(authUrl);
	const url = new URL(redirectedTo);
	const returnedState = url.searchParams.get("state");
	if (!returnedState || returnedState !== state) {
		throw new Error("OAuth state mismatch");
	}
	const code = url.searchParams.get("code");
	if (!code) {
		throw new Error("Missing OAuth authorization code");
	}

	const accessToken = await exchangeWebAuthCode(code, state, redirectUri);
	const username = await fetchAuthenticatedUser(accessToken);
	const current = await getStoredState();
	await saveStoredState({
		...current,
		githubToken: accessToken,
		auth: {
			isAuthenticated: true,
			username,
			method: "web",
		},
	});

	sendResponse({
		ok: true,
		data: { status: "authenticated", username },
	});
};

const handleLoginWithPat: Handler<"loginWithPat"> = async (data, sendResponse) => {
	const username = await fetchAuthenticatedUser(data.token.trim());
	const current = await getStoredState();
	await saveStoredState({
		...current,
		githubToken: data.token.trim(),
		auth: {
			isAuthenticated: true,
			username,
			method: "pat",
		},
	});

	sendResponse({
		ok: true,
		data: { status: "authenticated", username },
	});
};

const handleLogoutGithub: Handler<"logoutGithub"> = async (_data, sendResponse) => {
	await clearAuthState();
	sendResponse({ ok: true });
};

const handleClearRecentEvents: Handler<"clearRecentEvents"> = async (
	_data,
	sendResponse
) => {
	await clearRecentEvents();
	sendResponse({ ok: true });
};

const handleListRepos: Handler<"listRepos"> = async (_data, sendResponse) => {
	const state = await getStoredState();
	if (!state.githubToken) {
		sendResponse({ ok: false, error: "Not authenticated with GitHub" });
		return;
	}

	const repos = await listUserRepos(state.githubToken);
	sendResponse({ ok: true, data: repos });
};

const handleListBranches: Handler<"listBranches"> = async (data, sendResponse) => {
	const state = await getStoredState();
	if (!state.githubToken) {
		sendResponse({ ok: false, error: "Not authenticated with GitHub" });
		return;
	}
	const branches = await listBranches(state.githubToken, data.repoFullName);
	sendResponse({ ok: true, data: branches });
};

const handleCreateRepo: Handler<"createRepo"> = async (data, sendResponse) => {
	const state = await getStoredState();
	if (!state.githubToken) {
		sendResponse({ ok: false, error: "Not authenticated with GitHub" });
		return;
	}

	const repo = await createUserRepo(state.githubToken, data.name, data.private);
	await saveStoredState({
		...state,
		settings: {
			...state.settings,
			selectedRepoFullName: repo.fullName,
			selectedBranch: repo.defaultBranch,
		},
	});
	sendResponse({ ok: true, data: repo });
};

const handleCreateBranch: Handler<"createBranch"> = async (data, sendResponse) => {
	const state = await getStoredState();
	if (!state.githubToken) {
		sendResponse({ ok: false, error: "Not authenticated with GitHub" });
		return;
	}

	const branch: Branch = await createBranch(
		state.githubToken,
		data.repoFullName,
		data.newBranch,
		data.fromBranch
	);
	await saveStoredState({
		...state,
		settings: {
			...state.settings,
			selectedRepoFullName: data.repoFullName,
			selectedBranch: branch.name,
		},
	});
	sendResponse({ ok: true, data: branch });
};

const handleCssbattleSubmission: Handler<"cssbattleSubmission"> = async (
	data,
	sendResponse
) => {
	const state = await getStoredState();
	const threshold = state.settings.threshold;
	const matchPct = data.payload.matchPct ?? -1;
	const hasScoredResult = hasPositiveLastScore(data.payload);
	const accepted = hasScoredResult && matchPct >= threshold;
	const duplicate = isDuplicateSubmission(
		data.payload,
		state.lastSubmission,
		state.lastSubmissionFingerprint
	);
	let committed = false;
	let commitUrl: string | null = null;
	let skippedNotImproved = false;
	let errorOccurred = false;
	let reason = !hasScoredResult
		? "Submission skipped because Last score is zero, unavailable, or invalid"
		: accepted
		? "Submission accepted by threshold"
		: "Submission below threshold";
	let eventCode: SyncEventCode = hasScoredResult
		? accepted
			? "SYNC_COMMITTED"
			: "SYNC_SKIPPED_THRESHOLD"
		: "SYNC_SKIPPED_INVALID_SCORE";
	let recentEvents = state.recentEvents;

	try {
		if (duplicate) {
			reason = duplicateReasonMessage();
			eventCode = "SYNC_SKIPPED_DUPLICATE";
			recentEvents = pushEvent(recentEvents, "warn", reason, null, eventCode);
		} else if (accepted) {
			if (!state.githubToken) {
				reason = "Submission accepted but GitHub is not authenticated";
				eventCode = "SYNC_AUTH_REQUIRED";
				recentEvents = pushEvent(recentEvents, "warn", reason, null, eventCode);
			} else if (!state.settings.selectedRepoFullName) {
				reason = "Submission accepted but no repository selected";
				eventCode = "SYNC_REPO_REQUIRED";
				recentEvents = pushEvent(recentEvents, "warn", reason, null, eventCode);
			} else {
				const branch = state.settings.selectedBranch ?? "main";
				const currentMetrics: SavedSubmissionMetrics = {
					score: data.payload.score ?? 0,
					matchPct: data.payload.matchPct ?? 0,
				};
				const previousMetrics = await readBestSubmissionMetrics(
					state.githubToken,
					state.settings.selectedRepoFullName,
					branch,
					data.payload
				);
				if (previousMetrics && !isImprovedSubmission(currentMetrics, previousMetrics)) {
					skippedNotImproved = true;
					reason = notImprovedReasonMessage(currentMetrics, previousMetrics);
					eventCode = "SYNC_SKIPPED_NOT_IMPROVED";
					recentEvents = pushEvent(recentEvents, "warn", reason, null, eventCode);
				} else {
					const files = await buildSubmissionFiles(data.payload);
					const readmeMode = state.settings.repositoryReadmeMode ?? "managed-section";
					if (readmeMode !== "off") {
						try {
							const existingPaths = await listBranchBlobPaths(
								state.githubToken,
								state.settings.selectedRepoFullName,
								branch
							);
							const existingReadme = await fetchRepoUtf8File(
								state.githubToken,
								state.settings.selectedRepoFullName,
								branch,
								"README.md"
							);
							const rootReadme = buildRootReadmeContent({
								mode: readmeMode,
								existingReadme,
								existingBlobPaths: existingPaths,
								challengeFolder: challengeFolderPath(data.payload),
								challengeTitle: formatChallengeTitle(data.payload),
							});
							if (rootReadme !== null) {
								files.push({
									path: "README.md",
									content: rootReadme,
									encoding: "utf-8",
								});
							}
						} catch (readmeError) {
							console.warn("CssHub: root README update skipped", readmeError);
						}
					}
					const commitMessage = formatCommitMessage(
						data.payload.score,
						data.payload.matchPct
					);
					const commitResult = await commitFilesToRepo(
						state.githubToken,
						state.settings.selectedRepoFullName,
						branch,
						commitMessage,
						files
					);
					committed = true;
					commitUrl = commitResult.commitUrl;
					reason = "Submission committed to GitHub";
					eventCode = "SYNC_COMMITTED";
					recentEvents = pushEvent(
						recentEvents,
						"info",
						reason,
						commitUrl,
						eventCode
					);
				}
			}
		} else {
			recentEvents = pushEvent(recentEvents, "info", reason, null, eventCode);
		}
	} catch (error) {
		errorOccurred = true;
		committed = false;
		commitUrl = null;
		skippedNotImproved = false;
		const safeError = toUserSafeError(error);
		reason = safeError.message;
		eventCode = safeError.code;
		recentEvents = pushEvent(recentEvents, "error", reason, null, eventCode);
	}

	const responsePayload: SubmissionIngestionResponse =
		submissionIngestionResponseSchema.parse({
			accepted,
			threshold,
			reason,
			code: eventCode,
			committed,
			commitUrl,
		});

	const shouldAdvanceDuplicateBaseline = !duplicate && !errorOccurred;

	await saveStoredState({
		...state,
		lastSubmission: shouldAdvanceDuplicateBaseline
			? data.payload
			: state.lastSubmission,
		lastSubmissionAccepted: accepted,
		lastIngestion: responsePayload,
		lastSubmissionFingerprint: shouldAdvanceDuplicateBaseline
			? fingerprintSubmission(data.payload)
			: state.lastSubmissionFingerprint,
		recentEvents,
	});

	if (errorOccurred) {
		setActionBadge("error", "ERR");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"error",
			"CssHub error",
			reason
		);
		sendResponse({ ok: false, error: reason });
		return;
	}

	if (committed) {
		setActionBadge("success", "OK");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"success",
			"CssHub synced",
			reason
		);
	} else if (skippedNotImproved) {
		setActionBadge("warn", "BEST");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub kept best result",
			reason
		);
	} else if (accepted) {
		setActionBadge("warn", "WAIT");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub action needed",
			reason
		);
	} else if (duplicate) {
		setActionBadge("warn", "DUP");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub skipped duplicate",
			reason
		);
	} else {
		setActionBadge("warn", "SKIP");
		showBrowserNotification(
			state.settings.systemNotificationsEnabled,
			"warn",
			"CssHub skipped submission",
			reason
		);
	}

	sendResponse({
		ok: true,
		data: responsePayload,
	});
};

const actionHandlers: {
	[K in PopupToBackgroundMessage["action"]]: Handler<K>;
} = {
	captureElement: handleCaptureElement,
	getExtensionState: handleGetExtensionState,
	saveSettings: handleSaveSettings,
	startGithubDeviceFlow: handleStartGithubDeviceFlow,
	pollGithubDeviceFlow: handlePollGithubDeviceFlow,
	startGithubWebFlow: handleStartGithubWebFlow,
	loginWithPat: handleLoginWithPat,
	logoutGithub: handleLogoutGithub,
	clearRecentEvents: handleClearRecentEvents,
	listRepos: handleListRepos,
	listBranches: handleListBranches,
	createRepo: handleCreateRepo,
	createBranch: handleCreateBranch,
	extractCssbattleEditorCode: handleExtractCssbattleEditorCode,
	cssbattleSubmission: handleCssbattleSubmission,
};

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
	const parsed = popupToBackgroundMessageSchema.safeParse(request);
	if (!parsed.success) {
		sendResponse({
			ok: false,
			error: "Invalid message payload",
		});
		return;
	}

	const data = parsed.data;
	const handler = actionHandlers[data.action] as (
		payload: typeof data,
		reply: SendResponse,
		sender: chrome.runtime.MessageSender
	) => Promise<void>;

	void handler(data, sendResponse, _sender).catch((error: unknown) => {
		const safeError = toUserSafeError(error);
		setActionBadge("error", "ERR");
		void getStoredState()
			.then((state) => {
				showBrowserNotification(
					state.settings.systemNotificationsEnabled,
					"error",
					"CssHub error",
					safeError.message
				);
				return saveStoredState({
					...state,
					recentEvents: pushEvent(
						state.recentEvents,
						"error",
						safeError.message,
						null,
						safeError.code
					),
				});
			})
			.catch(() => undefined);
		sendResponse({
			ok: false,
			error: safeError.message,
		});
	});

	return true;
});
