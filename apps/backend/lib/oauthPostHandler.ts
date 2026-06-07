import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleCorsPreflight, setCorsHeaders } from "./cors.js";
import { getClientIp, rejectMethod } from "./http.js";
import { checkRateLimit } from "./rateLimit.js";

export type OAuthRateLimitConfig = {
	keyPrefix: string;
	limit: number;
	windowMs: number;
};

export const runOAuthPostRoute = async (
	req: VercelRequest,
	res: VercelResponse,
	rateLimitConfig: OAuthRateLimitConfig,
	handle: () => Promise<void>
): Promise<void> => {
	if (handleCorsPreflight(req, res)) {
		return;
	}
	if (rejectMethod(req, res, "POST")) {
		return;
	}
	setCorsHeaders(req, res);

	const ip = getClientIp(req);
	const rateLimit = await checkRateLimit({
		key: `${rateLimitConfig.keyPrefix}:${ip}`,
		limit: rateLimitConfig.limit,
		windowMs: rateLimitConfig.windowMs,
	});
	if (!rateLimit.allowed) {
		res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
		res.status(429).json({ error: "Too many requests" });
		return;
	}

	await handle();
};
