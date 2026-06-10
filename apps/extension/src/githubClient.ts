import { branchSchema, repoSchema, type Branch, type Repo } from "./shared/contracts";

const githubFetch = async (
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

const githubRequest = async <T>(
	token: string,
	path: string,
	init?: RequestInit
): Promise<T> => {
	const response = await githubFetch(token, path, init);

	if (!response.ok) {
		const payload = await response.text();
		throw new Error(`GitHub request failed (${response.status}): ${payload}`);
	}

	const payload = await response.text();
	if (!payload.trim()) {
		return undefined as T;
	}

	return JSON.parse(payload) as T;
};

export const fetchAuthenticatedUser = async (token: string): Promise<string> => {
	const data = await githubRequest<{ login: string }>(token, "/user");
	return data.login;
};

export const listUserRepos = async (token: string): Promise<Repo[]> => {
	const data = await githubRequest<
		Array<{
			id: number;
			name: string;
			full_name: string;
			private: boolean;
			default_branch: string;
			owner: { login: string };
		}>
	>(token, "/user/repos?per_page=100&sort=updated");

	return data
		.map((repo) =>
			repoSchema.parse({
				id: repo.id,
				name: repo.name,
				fullName: repo.full_name,
				owner: repo.owner.login,
				private: repo.private,
				defaultBranch: repo.default_branch,
			})
		)
		.sort((a, b) => a.fullName.localeCompare(b.fullName));
};

export const createUserRepo = async (
	token: string,
	name: string,
	isPrivate: boolean
): Promise<Repo> => {
	const data = await githubRequest<{
		id: number;
		name: string;
		full_name: string;
		private: boolean;
		default_branch: string;
		owner: { login: string };
	}>(token, "/user/repos", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name,
			private: isPrivate,
			auto_init: true,
		}),
	});

	return repoSchema.parse({
		id: data.id,
		name: data.name,
		fullName: data.full_name,
		owner: data.owner.login,
		private: data.private,
		defaultBranch: data.default_branch,
	});
};

const parseRepoFullName = (repoFullName: string): { owner: string; repo: string } => {
	const [owner, repo] = repoFullName.split("/");
	if (!owner || !repo) {
		throw new Error("Invalid repository full name");
	}
	return { owner, repo };
};

export const listBranches = async (
	token: string,
	repoFullName: string
): Promise<Branch[]> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const data = await githubRequest<Array<{ name: string }>>(
		token,
		`/repos/${owner}/${repo}/branches?per_page=100`
	);
	return data
		.map((branch) =>
			branchSchema.parse({
				name: branch.name,
			})
		)
		.sort((a, b) => a.name.localeCompare(b.name));
};

export const createBranch = async (
	token: string,
	repoFullName: string,
	newBranch: string,
	fromBranch: string
): Promise<Branch> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const fromSha = await getBranchHeadSha(token, owner, repo, fromBranch);
	await githubRequest(
		token,
		`/repos/${owner}/${repo}/git/refs`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				ref: `refs/heads/${newBranch}`,
				sha: fromSha,
			}),
		}
	);
	return branchSchema.parse({
		name: newBranch,
	});
};

type GitRefResponse = {
	object: {
		sha: string;
	};
};

type GitCommitResponse = {
	sha: string;
	tree: {
		sha: string;
	};
};

type GitBlobResponse = {
	sha: string;
};

type GitTreeResponse = {
	sha: string;
	tree?: Array<{
		path: string;
		type: string;
	}>;
};

type CommitBlobFile = {
	path: string;
	content: string;
	encoding: "utf-8" | "base64";
};

export type CommitFile =
	| CommitBlobFile
	| {
			path: string;
			delete: true;
	  };

export type CommitResult = {
	commitSha: string;
	commitUrl: string;
};

export type SavedSubmissionMetrics = {
	score: number;
	matchPct: number;
};

const encodeRepoPath = (path: string): string =>
	path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");

const parseSavedSubmissionMetrics = (
	raw: unknown
): SavedSubmissionMetrics | null => {
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
		throw new Error(`GitHub request failed (${response.status}): ${payload}`);
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
		throw new Error(`GitHub request failed (${response.status}): ${payload}`);
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

const getBranchHeadSha = async (
	token: string,
	owner: string,
	repo: string,
	branch: string
): Promise<string> => {
	const data = await githubRequest<GitRefResponse>(
		token,
		`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`
	);
	return data.object.sha;
};

const getCommit = async (
	token: string,
	owner: string,
	repo: string,
	sha: string
): Promise<GitCommitResponse> => {
	return githubRequest<GitCommitResponse>(
		token,
		`/repos/${owner}/${repo}/git/commits/${sha}`
	);
};

const createBlob = async (
	token: string,
	owner: string,
	repo: string,
	file: CommitBlobFile
): Promise<string> => {
	const data = await githubRequest<GitBlobResponse>(
		token,
		`/repos/${owner}/${repo}/git/blobs`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				content: file.content,
				encoding: file.encoding,
			}),
		}
	);

	return data.sha;
};

const createTree = async (
	token: string,
	owner: string,
	repo: string,
	baseTreeSha: string,
	treeEntries: Array<{
		path: string;
		mode?: string;
		type?: string;
		sha: string | null;
	}>
): Promise<string> => {
	const data = await githubRequest<GitTreeResponse>(
		token,
		`/repos/${owner}/${repo}/git/trees`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				base_tree: baseTreeSha,
				tree: treeEntries,
			}),
		}
	);
	return data.sha;
};

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
		data.tree
			?.filter((entry) => entry.type === "blob")
			.map((entry) => entry.path) ?? []
	);
};

const createCommit = async (
	token: string,
	owner: string,
	repo: string,
	message: string,
	treeSha: string,
	parentSha: string
): Promise<string> => {
	const data = await githubRequest<{ sha: string }>(
		token,
		`/repos/${owner}/${repo}/git/commits`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				message,
				tree: treeSha,
				parents: [parentSha],
			}),
		}
	);
	return data.sha;
};

const updateBranchRef = async (
	token: string,
	owner: string,
	repo: string,
	branch: string,
	commitSha: string
): Promise<void> => {
	await githubRequest(
		token,
		`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`,
		{
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				sha: commitSha,
				force: false,
			}),
		}
	);
};

const COMMIT_MAX_ATTEMPTS = 8;
const COMMIT_RETRY_BASE_DELAY_MS = 350;

const branchCommitQueues = new Map<string, Promise<unknown>>();

const withBranchCommitLock = async <T>(
	repoFullName: string,
	branch: string,
	task: () => Promise<T>
): Promise<T> => {
	const key = `${repoFullName}\0${branch}`;
	const previous = branchCommitQueues.get(key) ?? Promise.resolve();
	const next = previous.then(task, task);
	branchCommitQueues.set(
		key,
		next.then(
			() => undefined,
			() => undefined
		)
	);
	return next;
};

const sleep = (ms: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, ms);
	});

const getGithubErrorStatus = (error: unknown): number | null => {
	if (!(error instanceof Error)) {
		return null;
	}
	const matched = error.message.match(/GitHub request failed \((\d{3})\)/);
	if (!matched) {
		return null;
	}
	const status = Number(matched[1]);
	return Number.isFinite(status) ? status : null;
};

const isRetriableGithubConflict = (error: unknown): boolean => {
	const status = getGithubErrorStatus(error);
	return status === 409 || status === 422;
};

const buildTreeEntries = (
	files: CommitFile[],
	preparedBlobs: Map<string, string>,
	existingPaths: Set<string>
): Array<{
	path: string;
	mode?: string;
	type?: string;
	sha: string | null;
}> => {
	const treeEntries: Array<{
		path: string;
		mode?: string;
		type?: string;
		sha: string | null;
	}> = [];

	for (const file of files) {
		if ("delete" in file) {
			if (existingPaths.has(file.path)) {
				treeEntries.push({
					path: file.path,
					mode: "100644",
					type: "blob",
					sha: null,
				});
			}
			continue;
		}

		const blobSha = preparedBlobs.get(file.path);
		if (!blobSha) {
			throw new Error(`Missing prepared blob for ${file.path}`);
		}
		treeEntries.push({
			path: file.path,
			mode: "100644",
			type: "blob",
			sha: blobSha,
		});
	}

	return treeEntries;
};

const commitPreparedFilesToBranch = async (
	token: string,
	owner: string,
	repo: string,
	branch: string,
	message: string,
	files: CommitFile[],
	preparedBlobs: Map<string, string>
): Promise<CommitResult> => {
	let lastError: unknown;

	for (let attempt = 1; attempt <= COMMIT_MAX_ATTEMPTS; attempt += 1) {
		try {
			const headSha = await getBranchHeadSha(token, owner, repo, branch);
			const headCommit = await getCommit(token, owner, repo, headSha);
			const existingPaths = await getTreePaths(
				token,
				owner,
				repo,
				headCommit.tree.sha
			);
			const treeEntries = buildTreeEntries(files, preparedBlobs, existingPaths);

			const treeSha = await createTree(
				token,
				owner,
				repo,
				headCommit.tree.sha,
				treeEntries
			);
			const commitSha = await createCommit(
				token,
				owner,
				repo,
				message,
				treeSha,
				headSha
			);

			const latestHeadSha = await getBranchHeadSha(token, owner, repo, branch);
			if (latestHeadSha === commitSha) {
				return {
					commitSha,
					commitUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
				};
			}
			if (latestHeadSha !== headSha) {
				await sleep(COMMIT_RETRY_BASE_DELAY_MS * attempt);
				continue;
			}

			await updateBranchRef(token, owner, repo, branch, commitSha);

			return {
				commitSha,
				commitUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
			};
		} catch (error) {
			lastError = error;
			if (!isRetriableGithubConflict(error) || attempt === COMMIT_MAX_ATTEMPTS) {
				throw error;
			}
			await sleep(COMMIT_RETRY_BASE_DELAY_MS * attempt);
		}
	}

	throw lastError;
};

const prepareCommitBlobs = async (
	token: string,
	repoFullName: string,
	files: CommitFile[]
): Promise<Map<string, string>> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const preparedBlobs = new Map<string, string>();

	for (const file of files) {
		if ("delete" in file) {
			continue;
		}
		const blobSha = await createBlob(token, owner, repo, file);
		preparedBlobs.set(file.path, blobSha);
	}

	return preparedBlobs;
};

const commitFilesToRepoWithRetry = async (
	token: string,
	repoFullName: string,
	branch: string,
	message: string,
	files: CommitFile[]
): Promise<CommitResult> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const preparedBlobs = await prepareCommitBlobs(token, repoFullName, files);
	return commitPreparedFilesToBranch(
		token,
		owner,
		repo,
		branch,
		message,
		files,
		preparedBlobs
	);
};

export const commitFilesToRepo = async (
	token: string,
	repoFullName: string,
	branch: string,
	message: string,
	files: CommitFile[]
): Promise<CommitResult> =>
	withBranchCommitLock(repoFullName, branch, () =>
		commitFilesToRepoWithRetry(token, repoFullName, branch, message, files)
	);
