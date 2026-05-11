import { deviceFlowStartResponseSchema } from "./shared/contracts";

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
const GITHUB_CLIENT_ID = "Ov23likwEZqo4pEmKYVJ";
const GITHUB_CLIENT_SECRET = "";
const GITHUB_SCOPE = "repo read:user";

const assertClientId = (): string => {
	if (!GITHUB_CLIENT_ID) {
		throw new Error(
			"GitHub OAuth client id is not configured. Set it in githubAuth.ts before testing auth."
		);
	}
	return GITHUB_CLIENT_ID;
};

export const startDeviceFlow = async () => {
	const clientId = assertClientId();

	const response = await fetch(DEVICE_CODE_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: clientId,
			scope: GITHUB_SCOPE,
		}),
	});

	if (!response.ok) {
		throw new Error("Unable to start GitHub device flow");
	}

	const data = await response.json();
	const parsed = deviceFlowStartResponseSchema.safeParse({
		deviceCode: data.device_code,
		userCode: data.user_code,
		verificationUri: data.verification_uri,
		verificationUriComplete: data.verification_uri_complete ?? null,
		expiresIn: data.expires_in,
		interval: data.interval ?? 5,
	});

	if (!parsed.success) {
		throw new Error("Invalid device flow response from GitHub");
	}

	return parsed.data;
};

export const pollDeviceFlow = async (
	deviceCode: string
): Promise<string | null> => {
	const clientId = assertClientId();

	const response = await fetch(ACCESS_TOKEN_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: clientId,
			device_code: deviceCode,
			grant_type: DEVICE_GRANT_TYPE,
		}),
	});

	if (!response.ok) {
		throw new Error("GitHub token polling failed");
	}

	const data = await response.json();
	if (typeof data.access_token === "string") {
		return data.access_token;
	}

	if (data.error === "authorization_pending") {
		return null;
	}

	if (data.error === "slow_down") {
		return null;
	}

	throw new Error(data.error_description ?? "GitHub auth failed");
};

export const buildGithubAuthorizeUrl = (
	redirectUri: string,
	state: string
): string => {
	const clientId = assertClientId();
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		scope: GITHUB_SCOPE,
		state,
		allow_signup: "true",
	});
	return `${AUTHORIZE_URL}?${params.toString()}`;
};

export const exchangeWebAuthCode = async (code: string): Promise<string> => {
	const clientId = assertClientId();
	if (!GITHUB_CLIENT_SECRET) {
		throw new Error(
			"OAuth web flow requires a GitHub client secret in githubAuth.ts (or a backend token exchange)."
		);
	}

	const response = await fetch(ACCESS_TOKEN_URL, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			client_id: clientId,
			client_secret: GITHUB_CLIENT_SECRET,
			code,
		}),
	});

	if (!response.ok) {
		throw new Error("GitHub web auth token exchange failed");
	}

	const data = await response.json();
	if (typeof data.access_token === "string") {
		return data.access_token;
	}
	throw new Error(data.error_description ?? "GitHub web auth failed");
};
