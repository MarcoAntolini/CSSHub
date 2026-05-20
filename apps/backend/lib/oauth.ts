import { backendEnv } from "./env.js";

const REDIRECT_HOST_SUFFIX = ".chromiumapp.org";

const getExtensionIdFromRedirect = (redirectUri: string): string | null => {
	try {
		const parsed = new URL(redirectUri);
		if (parsed.protocol !== "https:") {
			return null;
		}
		if (!parsed.hostname.endsWith(REDIRECT_HOST_SUFFIX)) {
			return null;
		}
		if (parsed.pathname !== "/github") {
			return null;
		}
		return parsed.hostname.replace(REDIRECT_HOST_SUFFIX, "") || null;
	} catch (_error) {
		return null;
	}
};

export const isAllowedRedirectUri = (redirectUri: string): boolean => {
	const extensionId = getExtensionIdFromRedirect(redirectUri);
	if (!extensionId) {
		return false;
	}
	if (backendEnv.allowedExtensionIds.length === 0) {
		return true;
	}
	return backendEnv.allowedExtensionIds.includes(extensionId);
};
