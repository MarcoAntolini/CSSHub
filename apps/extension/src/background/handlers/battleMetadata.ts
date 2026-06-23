import { getCssbattleBattleMetadata } from "@/cssbattleBattleMetadata";
import { getStoredState, saveStoredState } from "@/storage";
import { readBattleMetadataHtml } from "@/background/battleMetadataTransport";
import type { Handler } from "./types";

export const handleFetchCssbattleBattleMetadata: Handler<
	"fetchCssbattleBattleMetadata"
> = async (data, sendResponse) => {
	const state = await getStoredState();
	const result = await getCssbattleBattleMetadata(
		data.battleId,
		state.battleMetadataCache,
		readBattleMetadataHtml
	);

	if (result.cache !== state.battleMetadataCache) {
		await saveStoredState({
			...state,
			battleMetadataCache: result.cache,
		});
	}

	sendResponse({
		ok: true,
		data: result.metadata,
	});
};
