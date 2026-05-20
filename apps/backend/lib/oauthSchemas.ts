import { z } from "zod";

// Keep backend runtime validation local to this app so serverless bundles
// never depend on generated/copied artifacts.
export const oauthExchangeRequestSchema = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
	redirectUri: z.string().url(),
});

export const githubOAuthTokenRawSchema = z.object({
	access_token: z.string().min(1).optional(),
	token_type: z.string().optional(),
	scope: z.string().optional(),
	error: z.string().optional(),
	error_description: z.string().optional(),
});
