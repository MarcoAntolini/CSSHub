import { redisClient } from "./redis.js";

const OAUTH_STATE_TTL_SEC = 10 * 60;
const memoryStateStore = new Map<string, number>();

const stateKey = (state: string): string => `oauth:state:${state}`;

const newStateToken = (): string =>
	`${crypto.randomUUID().replace(/-/g, "")}${crypto
		.randomUUID()
		.replace(/-/g, "")}`;

export const issueOAuthState = async (): Promise<{
	state: string;
	expiresInSec: number;
}> => {
	if (redisClient) {
		for (let attempt = 0; attempt < 5; attempt += 1) {
			const state = newStateToken();
			const result = await redisClient.set(stateKey(state), "1", {
				ex: OAUTH_STATE_TTL_SEC,
				nx: true,
			});
			if (result) {
				return { state, expiresInSec: OAUTH_STATE_TTL_SEC };
			}
		}
		throw new Error("Unable to allocate OAuth state");
	} else {
		const state = newStateToken();
		memoryStateStore.set(state, Date.now() + OAUTH_STATE_TTL_SEC * 1000);
		return { state, expiresInSec: OAUTH_STATE_TTL_SEC };
	}
};

export const consumeOAuthState = async (state: string): Promise<boolean> => {
	if (redisClient) {
		const key = stateKey(state);
		const exists = await redisClient.get<string>(key);
		if (!exists) {
			return false;
		}
		await redisClient.del(key);
		return true;
	}

	const expiresAt = memoryStateStore.get(state);
	if (!expiresAt) {
		return false;
	}
	memoryStateStore.delete(state);
	return expiresAt > Date.now();
};
