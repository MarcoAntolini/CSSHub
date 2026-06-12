import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
	githubOAuthTokenRawSchema,
	oauthExchangeRequestSchema,
} from "../../../lib/oauth/schemas.js";
import { backendEnv } from "../../../lib/env.js";
import { runOAuthPostRoute } from "../../../lib/oauthPostHandler.js";
import { consumeOAuthState } from "../../../lib/oauthState.js";
import { isAllowedRedirectUri } from "../../../lib/oauth.js";

const EXCHANGE_RATE_LIMIT = {
	keyPrefix: "oauth-exchange",
	limit: 12,
	windowMs: 5 * 60 * 1000,
};

const normalizeRequestBody = (body: unknown): unknown => {
	if (typeof body !== "string") {
		return body;
	}
	try {
		return JSON.parse(body);
	} catch (_error) {
		return body;
	}
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
	await runOAuthPostRoute(req, res, EXCHANGE_RATE_LIMIT, async () => {
		const parsedPayload = oauthExchangeRequestSchema.safeParse(
			normalizeRequestBody(req.body)
		);
		if (!parsedPayload.success) {
			console.warn("OAuth exchange rejected: invalid request payload");
			res.status(400).json({ error: "Invalid request payload" });
			return;
		}

		const { code, state, redirectUri } = parsedPayload.data;
		if (!isAllowedRedirectUri(redirectUri)) {
			console.warn("OAuth exchange rejected: invalid redirect URI");
			res.status(400).json({ error: "Invalid redirect URI" });
			return;
		}

		const stateIsValid = await consumeOAuthState(state);
		if (!stateIsValid) {
			console.warn("OAuth exchange rejected: invalid or expired state");
			res.status(400).json({ error: "Invalid or expired OAuth state" });
			return;
		}

		try {
			const token = await exchangeCodeForToken(code, redirectUri);
			res.status(200).json(token);
		} catch (error) {
			console.warn(
				"OAuth exchange rejected: GitHub token exchange failed",
				error instanceof Error ? error.message : String(error)
			);
			res.status(502).json({ error: "OAuth exchange failed" });
		}
	});
}
