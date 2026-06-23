import {
	BATTLE_METADATA_PROBE_RESULT,
	BATTLE_METADATA_REQUEST_ID_PARAM,
	READ_BATTLE_METADATA_OFFSCREEN,
	type BattleMetadataOffscreenResponse,
	type BattleMetadataProbeResultMessage,
	type ReadBattleMetadataOffscreenMessage,
} from "./battleMetadataMessages";
import { normalizeHydratedBattlePageMetadata } from "./battleMetadataHydration";

type PendingRequest = {
	sendResponse: (response: BattleMetadataOffscreenResponse) => void;
	timeoutId: number;
	iframe: HTMLIFrameElement;
};

const pendingRequests = new Map<string, PendingRequest>();

export const buildBattleMetadataProbeUrl = (url: string, requestId: string): string => {
	const parsed = new URL(url);
	const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ""));
	hashParams.set(BATTLE_METADATA_REQUEST_ID_PARAM, requestId);
	parsed.hash = hashParams.toString();
	return parsed.toString();
};

const removeIframe = (iframe: HTMLIFrameElement): void => {
	iframe.remove();
};

const finishRequest = (
	requestId: string,
	response: BattleMetadataOffscreenResponse
): void => {
	const pending = pendingRequests.get(requestId);
	if (!pending) {
		return;
	}
	window.clearTimeout(pending.timeoutId);
	removeIframe(pending.iframe);
	pendingRequests.delete(requestId);
	pending.sendResponse(response);
};

const handleReadRequest = (
	message: ReadBattleMetadataOffscreenMessage,
	sendResponse: (response: BattleMetadataOffscreenResponse) => void
): true => {
	const iframe = document.createElement("iframe");
	iframe.hidden = true;
	iframe.src = buildBattleMetadataProbeUrl(message.url, message.requestId);
	document.body.append(iframe);

	const timeoutId = window.setTimeout(() => {
		finishRequest(message.requestId, {
			ok: false,
			error: "CSSBattle offscreen battle page timed out before metadata was read",
		});
	}, message.timeoutMs);

	pendingRequests.set(message.requestId, {
		sendResponse,
		timeoutId,
		iframe,
	});

	return true;
};

const handleProbeResult = (message: BattleMetadataProbeResultMessage): void => {
	const metadata = normalizeHydratedBattlePageMetadata(message.metadata);
	if (!metadata) {
		return;
	}
	finishRequest(message.requestId, {
		ok: true,
		metadata,
	});
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message?.type === READ_BATTLE_METADATA_OFFSCREEN) {
		return handleReadRequest(message, sendResponse);
	}
	if (message?.type === BATTLE_METADATA_PROBE_RESULT) {
		handleProbeResult(message);
	}
	return false;
});
