import type { HydratedBattlePageMetadata } from "./battleMetadataHydration";

export const BATTLE_METADATA_REQUEST_ID_PARAM = "csshubMetadataRequestId";
export const READ_BATTLE_METADATA_OFFSCREEN = "CSSHUB_READ_BATTLE_METADATA_OFFSCREEN";
export const BATTLE_METADATA_PROBE_RESULT = "CSSHUB_BATTLE_METADATA_PROBE_RESULT";

export type ReadBattleMetadataOffscreenMessage = {
	type: typeof READ_BATTLE_METADATA_OFFSCREEN;
	requestId: string;
	url: string;
	timeoutMs: number;
	intervalMs: number;
	stableTicksRequired: number;
};

export type BattleMetadataProbeResultMessage = {
	type: typeof BATTLE_METADATA_PROBE_RESULT;
	requestId: string;
	metadata: HydratedBattlePageMetadata;
};

export type BattleMetadataInternalMessage =
	| ReadBattleMetadataOffscreenMessage
	| BattleMetadataProbeResultMessage;

export type BattleMetadataOffscreenResponse =
	| { ok: true; metadata: HydratedBattlePageMetadata }
	| { ok: false; error: string };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object";

export const isBattleMetadataInternalMessage = (
	value: unknown
): value is BattleMetadataInternalMessage =>
	isRecord(value) &&
	(value.type === READ_BATTLE_METADATA_OFFSCREEN ||
		value.type === BATTLE_METADATA_PROBE_RESULT);
