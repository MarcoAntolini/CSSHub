import { Redis } from "@upstash/redis";
import { backendEnv } from "./env";

const hasRedisConfig =
	typeof backendEnv.upstashRedisRestUrl === "string" &&
	backendEnv.upstashRedisRestUrl.length > 0 &&
	typeof backendEnv.upstashRedisRestToken === "string" &&
	backendEnv.upstashRedisRestToken.length > 0;

export const redisClient = hasRedisConfig
	? new Redis({
			url: backendEnv.upstashRedisRestUrl!,
			token: backendEnv.upstashRedisRestToken!,
	  })
	: null;
