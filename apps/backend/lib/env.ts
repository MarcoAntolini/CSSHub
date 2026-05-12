import { ensureBackendEnvLoaded } from "./loadEnv";

ensureBackendEnvLoaded();

const getRequiredEnv = (name: string): string => {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
};

const splitCsv = (value: string | undefined): string[] =>
	(value ?? "")
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);

export const backendEnv = {
	githubClientId: getRequiredEnv("GITHUB_CLIENT_ID"),
	githubClientSecret: getRequiredEnv("GITHUB_CLIENT_SECRET"),
	allowedExtensionIds: splitCsv(process.env.ALLOWED_EXTENSION_IDS),
	upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL ?? null,
	upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? null,
};
