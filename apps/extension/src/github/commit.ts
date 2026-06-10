import { getBranchHeadSha } from "./repos";
import { isRetriableGithubConflict } from "./githubError";
import type { CommitBlobFile, CommitFile, CommitResult } from "./types";
import { githubRequest, parseRepoFullName } from "./transport";

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

const getCommit = async (
	token: string,
	owner: string,
	repo: string,
	sha: string
): Promise<GitCommitResponse> =>
	githubRequest<GitCommitResponse>(token, `/repos/${owner}/${repo}/git/commits/${sha}`);

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
		data.tree?.filter((entry) => entry.type === "blob").map((entry) => entry.path) ?? []
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
