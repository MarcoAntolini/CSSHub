import {
	BATTLE_METADATA_POLL_INTERVAL_MS,
	BATTLE_METADATA_POLL_TIMEOUT_MS,
	BATTLE_METADATA_STABLE_TICKS,
	type HydratedBattlePageMetadata,
} from "@/battleMetadataHydration";
import {
	READ_BATTLE_METADATA_OFFSCREEN,
	type BattleMetadataOffscreenResponse,
	type ReadBattleMetadataOffscreenMessage,
} from "@/battleMetadataMessages";

type ChromeOffscreenApi = {
	Reason?: {
		DOM_SCRAPING?: string;
	};
	createDocument: (options: {
		url: string;
		reasons: string[];
		justification: string;
	}) => Promise<void>;
	hasDocument?: () => Promise<boolean>;
};

const OFFSCREEN_DOCUMENT_URL = "offscreen.html";
const OFFSCREEN_JUSTIFICATION =
	"Read hydrated CSSBattle battle metadata without opening a visible tab.";

let offscreenCreation: Promise<void> | null = null;

const getOffscreenApi = (): ChromeOffscreenApi => {
	const offscreen = (chrome as typeof chrome & { offscreen?: ChromeOffscreenApi })
		.offscreen;
	if (!offscreen) {
		throw new Error("Chrome offscreen API is unavailable");
	}
	return offscreen;
};

const ensureOffscreenDocument = async (): Promise<void> => {
	const offscreen = getOffscreenApi();
	if (offscreen.hasDocument && (await offscreen.hasDocument())) {
		return;
	}

	offscreenCreation ??= offscreen
		.createDocument({
			url: OFFSCREEN_DOCUMENT_URL,
			reasons: [offscreen.Reason?.DOM_SCRAPING ?? "DOM_SCRAPING"],
			justification: OFFSCREEN_JUSTIFICATION,
		})
		.catch(async (error: unknown) => {
			if (offscreen.hasDocument && (await offscreen.hasDocument())) {
				return;
			}
			throw error;
		})
		.finally(() => {
			offscreenCreation = null;
		});

	await offscreenCreation;
};

const sendOffscreenMessage = (
	message: ReadBattleMetadataOffscreenMessage
): Promise<BattleMetadataOffscreenResponse> =>
	new Promise((resolve, reject) => {
		chrome.runtime.sendMessage(message, (response: BattleMetadataOffscreenResponse) => {
			const lastError = chrome.runtime.lastError;
			if (lastError) {
				reject(new Error(lastError.message));
				return;
			}
			resolve(response);
		});
	});

export const readOffscreenBattleMetadata = async (
	url: string
): Promise<HydratedBattlePageMetadata> => {
	await ensureOffscreenDocument();
	const requestId = crypto.randomUUID();
	const response = await sendOffscreenMessage({
		type: READ_BATTLE_METADATA_OFFSCREEN,
		requestId,
		url,
		timeoutMs: BATTLE_METADATA_POLL_TIMEOUT_MS,
		intervalMs: BATTLE_METADATA_POLL_INTERVAL_MS,
		stableTicksRequired: BATTLE_METADATA_STABLE_TICKS,
	});

	if (!response?.ok) {
		throw new Error(response?.error ?? "CSSBattle offscreen metadata read failed");
	}
	return response.metadata;
};
