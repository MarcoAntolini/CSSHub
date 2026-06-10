import { GithubApiError } from "./githubError";

export const githubFetch = async (
	token: string,
	path: string,
	init?: RequestInit
): Promise<Response> =>
	fetch(`https://api.github.com${path}`, {
		...init,
		cache: "no-store",
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			Pragma: "no-cache",
			"Cache-Control": "no-cache",
			...(init?.headers ?? {}),
		},
	});

export const githubRequest = async <T>(
	token: string,
	path: string,
	init?: RequestInit
): Promise<T> => {
	const response = await githubFetch(token, path, init);

	if (!response.ok) {
		const payload = await response.text();
		throw new GithubApiError(response.status, payload);
	}

	const payload = await response.text();
	if (!payload.trim()) {
		return undefined as T;
	}

	return JSON.parse(payload) as T;
};

export const parseRepoFullName = (repoFullName: string): { owner: string; repo: string } => {
	const [owner, repo] = repoFullName.split("/");
	if (!owner || !repo) {
		throw new Error("Invalid repository full name");
	}
	return { owner, repo };
};

export const encodeRepoPath = (path: string): string =>
	path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
