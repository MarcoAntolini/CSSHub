import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCorsPreflight, setCorsHeaders } from "../../../lib/cors.js";
import { rejectMethod, getClientIp } from "../../../lib/http.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { issueOAuthState } from "../../../lib/oauthState.js";
import { backendEnv } from "../../../lib/env.js";

const STATE_RATE_LIMIT = {
	limit: 20,
	windowMs: 5 * 60 * 1000,
};

export default async function handler(
	req: VercelRequest,
	res: VercelResponse
): Promise<void> {
	if (handleCorsPreflight(req, res)) {
		return;
	}
	if (rejectMethod(req, res, "POST")) {
		return;
	}
	setCorsHeaders(req, res);

	const ip = getClientIp(req);
	const rateLimit = await checkRateLimit({
		key: `oauth-state:${ip}`,
		limit: STATE_RATE_LIMIT.limit,
		windowMs: STATE_RATE_LIMIT.windowMs,
	});
	if (!rateLimit.allowed) {
		res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
		res.status(429).json({ error: "Too many requests" });
		return;
	}

	const payload = await issueOAuthState();
	res.status(200).json({
		...payload,
		githubClientId: backendEnv.githubClientId,
	});
}
