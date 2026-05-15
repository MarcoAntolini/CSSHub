import { z } from "zod";

/** POST /api/oauth/github/exchange request body (extension → backend). */
export const oauthExchangeRequestSchema = z.object({
	code: z.string().min(1),
	state: z.string().min(1),
	redirectUri: z.string().url(),
});

export type OAuthExchangeRequest = z.infer<typeof oauthExchangeRequestSchema>;

/** POST /api/oauth/github/exchange success response (backend → extension). */
export const oauthExchangeResponseSchema = z.object({
	accessToken: z.string().min(1),
	tokenType: z.string(),
	scope: z.string(),
});

export type OAuthExchangeResponse = z.infer<typeof oauthExchangeResponseSchema>;

/** POST /api/oauth/github/state success response (backend → extension). */
export const oauthStateResponseSchema = z.object({
	state: z.string().min(1),
	expiresInSec: z.number().positive(),
	githubClientId: z.string().min(1),
});

export type OAuthStateResponse = z.infer<typeof oauthStateResponseSchema>;

/** GitHub access_token endpoint JSON (snake_case). */
export const githubOAuthTokenRawSchema = z.object({
	access_token: z.string().min(1).optional(),
	token_type: z.string().optional(),
	scope: z.string().optional(),
	error: z.string().optional(),
	error_description: z.string().optional(),
});

export type GithubOAuthTokenRaw = z.infer<typeof githubOAuthTokenRawSchema>;
