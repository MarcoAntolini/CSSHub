import {
	BATTLE_METADATA_PROBE_RESULT,
	BATTLE_METADATA_REQUEST_ID_PARAM,
} from "./battleMetadataMessages";
import {
	BATTLE_METADATA_POLL_INTERVAL_MS,
	BATTLE_METADATA_POLL_TIMEOUT_MS,
	BATTLE_METADATA_STABLE_TICKS,
	pollHydratedBattlePageMetadata,
} from "./battleMetadataHydration";

const getRequestId = (): string | null => {
	const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
	return hashParams.get(BATTLE_METADATA_REQUEST_ID_PARAM);
};

const requestId = getRequestId();

if (requestId) {
	void pollHydratedBattlePageMetadata(
		BATTLE_METADATA_POLL_TIMEOUT_MS,
		BATTLE_METADATA_POLL_INTERVAL_MS,
		BATTLE_METADATA_STABLE_TICKS
	)
		.then((metadata) =>
			chrome.runtime.sendMessage({
				type: BATTLE_METADATA_PROBE_RESULT,
				requestId,
				metadata,
			})
		)
		.catch(() => undefined);
}
