import type { VercelRequest, VercelResponse } from "@vercel/node";
import { backendEnv } from "../../../lib/env.js";
import { runOAuthPostRoute } from "../../../lib/oauthPostHandler.js";
import { issueOAuthState } from "../../../lib/oauthState.js";

const STATE_RATE_LIMIT = {
	keyPrefix: "oauth-state",
	limit: 20,
	windowMs: 5 * 60 * 1000,
};

export default async function handler(
	req: VercelRequest,
	res: VercelResponse
): Promise<void> {
	await runOAuthPostRoute(req, res, STATE_RATE_LIMIT, async () => {
		const payload = await issueOAuthState();
		res.status(200).json({
			...payload,
			githubClientId: backendEnv.githubClientId,
		});
	});
}
