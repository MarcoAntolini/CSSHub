import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { backendEnv } from "./env.js";
import { redisClient } from "./redis.js";

const OAUTH_STATE_TTL_SEC = 10 * 60;
const STATE_TOKEN_VERSION = "v1";

const stateKey = (state: string): string => `oauth:state:${state}`;

const newStateToken = (): string =>
	`${crypto.randomUUID().replace(/-/g, "")}${crypto
		.randomUUID()
		.replace(/-/g, "")}`;

const getNowSec = (): number => Math.floor(Date.now() / 1000);

const signStatePayload = (payload: string): string =>
	createHmac("sha256", backendEnv.githubClientSecret)
		.update(payload)
		.digest("base64url");

const issueSignedState = (): string => {
	const expiresAtSec = getNowSec() + OAUTH_STATE_TTL_SEC;
	const nonce = randomBytes(32).toString("base64url");
	const payload = `${expiresAtSec}.${nonce}`;
	const signature = signStatePayload(payload);
	return `${STATE_TOKEN_VERSION}.${payload}.${signature}`;
};

const verifySignedState = (state: string): boolean => {
	const parts = state.split(".");
	if (parts.length !== 4 || parts[0] !== STATE_TOKEN_VERSION) {
		return false;
	}

	const [, expiresAtRaw, nonce, signature] = parts;
	if (!expiresAtRaw || !nonce || !signature) {
		return false;
	}

	const expiresAtSec = Number(expiresAtRaw);
	if (!Number.isSafeInteger(expiresAtSec) || expiresAtSec <= getNowSec()) {
		return false;
	}

	const payload = `${expiresAtRaw}.${nonce}`;
	const expected = signStatePayload(payload);
	const actualBuffer = Buffer.from(signature, "base64url");
	const expectedBuffer = Buffer.from(expected, "base64url");
	if (actualBuffer.length !== expectedBuffer.length) {
		return false;
	}
	return timingSafeEqual(actualBuffer, expectedBuffer);
};

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
		const state = issueSignedState();
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

	return verifySignedState(state);
};
