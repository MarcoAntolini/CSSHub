import type { PopupToBackgroundMessage } from "../../shared/contracts";
import { getStoredState } from "../../storage";

export type MessageResponse = { ok: boolean; data?: unknown; error?: string };
export type SendResponse = (response: MessageResponse) => void;

export type Handler<TAction extends PopupToBackgroundMessage["action"]> = (
	data: Extract<PopupToBackgroundMessage, { action: TAction }>,
	sendResponse: SendResponse,
	sender: chrome.runtime.MessageSender
) => Promise<void>;

export const getAuthenticatedState = async (
	sendResponse: SendResponse
): Promise<
	(Awaited<ReturnType<typeof getStoredState>> & { githubToken: string }) | null
> => {
	const state = await getStoredState();
	if (!state.githubToken) {
		sendResponse({ ok: false, error: "Not authenticated with GitHub" });
		return null;
	}
	return state as Awaited<ReturnType<typeof getStoredState>> & {
		githubToken: string;
	};
};
