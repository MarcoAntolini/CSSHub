import { GithubApiError } from "./githubError";
import type { SavedSubmissionMetrics } from "./types";
import { encodeRepoPath, githubFetch, githubRequest, parseRepoFullName } from "./transport";
import { getBranchHeadSha } from "./repos";

type GitCommitResponse = {
	sha: string;
	tree: {
		sha: string;
	};
};

type GitTreeResponse = {
	sha: string;
	tree?: Array<{
		path: string;
		type: string;
	}>;
};

const parseSavedSubmissionMetrics = (raw: unknown): SavedSubmissionMetrics | null => {
	if (!raw || typeof raw !== "object") {
		return null;
	}
	const data = raw as Record<string, unknown>;
	if (
		typeof data.score !== "number" ||
		!Number.isFinite(data.score) ||
		typeof data.matchPct !== "number" ||
		!Number.isFinite(data.matchPct)
	) {
		return null;
	}
	return {
		score: data.score,
		matchPct: data.matchPct,
	};
};

const getCommit = async (
	token: string,
	owner: string,
	repo: string,
	sha: string
): Promise<GitCommitResponse> =>
	githubRequest<GitCommitResponse>(token, `/repos/${owner}/${repo}/git/commits/${sha}`);

const getTreePaths = async (
	token: string,
	owner: string,
	repo: string,
	treeSha: string
): Promise<Set<string>> => {
	const data = await githubRequest<GitTreeResponse>(
		token,
		`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
	);
	return new Set(
		data.tree?.filter((entry) => entry.type === "blob").map((entry) => entry.path) ?? []
	);
};

export const getSavedSubmissionMetrics = async (
	token: string,
	repoFullName: string,
	branch: string,
	metadataPath: string
): Promise<SavedSubmissionMetrics | null> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const response = await githubFetch(
		token,
		`/repos/${owner}/${repo}/contents/${encodeRepoPath(metadataPath)}?ref=${encodeURIComponent(branch)}`
	);

	if (response.status === 404) {
		return null;
	}
	if (response.status === 409 || response.status === 422) {
		return null;
	}
	if (!response.ok) {
		const payload = await response.text();
		throw new GithubApiError(response.status, payload);
	}

	const data = (await response.json()) as {
		content?: unknown;
		encoding?: unknown;
	};
	if (data.encoding !== "base64" || typeof data.content !== "string") {
		return null;
	}

	try {
		const decoded = atob(data.content.replace(/\n/g, ""));
		const parsed = JSON.parse(decoded) as unknown;
		return parseSavedSubmissionMetrics(parsed);
	} catch (_error) {
		return null;
	}
};

export const fetchRepoUtf8File = async (
	token: string,
	repoFullName: string,
	branch: string,
	filePath: string
): Promise<string | null> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const response = await githubFetch(
		token,
		`/repos/${owner}/${repo}/contents/${encodeRepoPath(filePath)}?ref=${encodeURIComponent(branch)}`
	);

	if (response.status === 404) {
		return null;
	}
	if (response.status === 409 || response.status === 422) {
		return null;
	}
	if (!response.ok) {
		const payload = await response.text();
		throw new GithubApiError(response.status, payload);
	}

	const data = (await response.json()) as {
		content?: unknown;
		encoding?: unknown;
	};
	if (data.encoding !== "base64" || typeof data.content !== "string") {
		return null;
	}

	try {
		const binary = atob(data.content.replace(/\n/g, ""));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
	} catch (_error) {
		return null;
	}
};

export const listBranchBlobPaths = async (
	token: string,
	repoFullName: string,
	branch: string
): Promise<Set<string>> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const headSha = await getBranchHeadSha(token, owner, repo, branch);
	const headCommit = await getCommit(token, owner, repo, headSha);
	return getTreePaths(token, owner, repo, headCommit.tree.sha);
};
