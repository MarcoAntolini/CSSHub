import { redisClient } from "./redis";

type RateLimitConfig = {
	key: string;
	limit: number;
	windowMs: number;
};

type RateLimitResult = {
	allowed: boolean;
	retryAfterSec: number;
};

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

const checkMemoryLimit = ({
	key,
	limit,
	windowMs,
}: RateLimitConfig): RateLimitResult => {
	const now = Date.now();
	const current = memoryBuckets.get(key);
	if (!current || current.resetAt <= now) {
		memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
		return { allowed: true, retryAfterSec: Math.ceil(windowMs / 1000) };
	}

	const nextCount = current.count + 1;
	memoryBuckets.set(key, { ...current, count: nextCount });
	const remainingMs = Math.max(current.resetAt - now, 0);
	return {
		allowed: nextCount <= limit,
		retryAfterSec: Math.ceil(remainingMs / 1000),
	};
};

export const checkRateLimit = async (
	config: RateLimitConfig
): Promise<RateLimitResult> => {
	if (!redisClient) {
		return checkMemoryLimit(config);
	}

	const redisKey = `ratelimit:${config.key}`;
	const count = await redisClient.incr(redisKey);
	if (count === 1) {
		await redisClient.pexpire(redisKey, config.windowMs);
	}
	const ttlMs = Math.max((await redisClient.pttl(redisKey)) ?? 0, 0);
	return {
		allowed: count <= config.limit,
		retryAfterSec: Math.ceil(ttlMs / 1000),
	};
};
