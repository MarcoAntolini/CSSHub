const CSSBATTLE_ORIGINS = ["https://cssbattle.dev", "https://www.cssbattle.dev"] as const;

/** Resolve relative CSSBattle asset paths for fetches from the extension service worker. */
export const resolveCssBattleImageUrl = (
	url: string,
	challengeUrl?: string | null
): string => {
	if (url.startsWith("data:") || url.startsWith("blob:")) {
		return url;
	}

	try {
		if (challengeUrl) {
			return new URL(url, challengeUrl).href;
		}
	} catch (_error) {
		// fall through to default origin
	}

	try {
		return new URL(url, CSSBATTLE_ORIGINS[0]).href;
	} catch (_error) {
		return url;
	}
};
