import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCorsPreflight, setCorsHeaders } from "../../../lib/cors.js";
import { rejectMethod } from "../../../lib/http.js";
import { ensureBackendEnvLoaded } from "../../../lib/loadEnv.js";

const REQUIRED_ENV_NAMES = ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"] as const;
const OPTIONAL_ENV_NAMES = [
	"ALLOWED_EXTENSION_IDS",
	"UPSTASH_REDIS_REST_URL",
	"UPSTASH_REDIS_REST_TOKEN",
] as const;

const hasValue = (name: string): boolean => {
	const value = process.env[name];
	return typeof value === "string" && value.trim().length > 0;
};

export default async function handler(
	req: VercelRequest,
	res: VercelResponse
): Promise<void> {
	ensureBackendEnvLoaded();

	if (handleCorsPreflight(req, res)) {
		return;
	}
	if (rejectMethod(req, res, "GET")) {
		return;
	}
	setCorsHeaders(req, res);

	const required = Object.fromEntries(
		REQUIRED_ENV_NAMES.map((name) => [name, hasValue(name)])
	);
	const optional = Object.fromEntries(
		OPTIONAL_ENV_NAMES.map((name) => [name, hasValue(name)])
	);
	const missingRequired = REQUIRED_ENV_NAMES.filter(
		(name) => !required[name]
	);
	const ok = missingRequired.length === 0;

	res.status(ok ? 200 : 503).json({
		ok,
		service: "oauth-github",
		required,
		optional,
		missingRequired,
	});
}
