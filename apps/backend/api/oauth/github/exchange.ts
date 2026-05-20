import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
	githubOAuthTokenRawSchema,
	oauthExchangeRequestSchema,
} from "../../../lib/shared-dist/oauth/schemas.js";
import { handleCorsPreflight, setCorsHeaders } from "../../../lib/cors.js";
import { backendEnv } from "../../../lib/env.js";
import { rejectMethod, getClientIp } from "../../../lib/http.js";
import { checkRateLimit } from "../../../lib/rateLimit.js";
import { consumeOAuthState } from "../../../lib/oauthState.js";
import { isAllowedRedirectUri } from "../../../lib/oauth.js";

const EXCHANGE_RATE_LIMIT = {
	limit: 12,
	windowMs: 5 * 60 * 1000,
};

const exchangeCodeForToken = async (
	code: string,
	redirectUri: string
): Promise<{ accessToken: string; tokenType: string; scope: string }> => {
	const response = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: backendEnv.githubClientId,
			client_secret: backendEnv.githubClientSecret,
			code,
			redirect_uri: redirectUri,
		}),
	});

	if (!response.ok) {
		throw new Error("GitHub token exchange failed");
	}

	const raw = await response.json();
	const parsed = githubOAuthTokenRawSchema.safeParse(raw);
	if (!parsed.success) {
		throw new Error("Invalid GitHub token response");
	}

	if (!parsed.data.access_token) {
		throw new Error(parsed.data.error_description ?? "OAuth exchange failed");
	}

	return {
		accessToken: parsed.data.access_token,
		tokenType: parsed.data.token_type ?? "bearer",
		scope: parsed.data.scope ?? "",
	};
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
		key: `oauth-exchange:${ip}`,
		limit: EXCHANGE_RATE_LIMIT.limit,
		windowMs: EXCHANGE_RATE_LIMIT.windowMs,
	});
	if (!rateLimit.allowed) {
		res.setHeader("Retry-After", String(rateLimit.retryAfterSec));
		res.status(429).json({ error: "Too many requests" });
		return;
	}

	const parsedPayload = oauthExchangeRequestSchema.safeParse(req.body);
	if (!parsedPayload.success) {
		res.status(400).json({ error: "Invalid request payload" });
		return;
	}

	const { code, state, redirectUri } = parsedPayload.data;
	if (!isAllowedRedirectUri(redirectUri)) {
		res.status(400).json({ error: "Invalid redirect URI" });
		return;
	}

	const stateIsValid = await consumeOAuthState(state);
	if (!stateIsValid) {
		res.status(400).json({ error: "Invalid or expired OAuth state" });
		return;
	}

	try {
		const token = await exchangeCodeForToken(code, redirectUri);
		res.status(200).json(token);
	} catch (_error) {
		res.status(502).json({ error: "OAuth exchange failed" });
	}
}
