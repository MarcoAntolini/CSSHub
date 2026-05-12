import { branchSchema, repoSchema, type Branch, type Repo } from "./shared/contracts";

const githubRequest = async <T>(
	token: string,
	path: string,
	init?: RequestInit
): Promise<T> => {
	const response = await fetch(`https://api.github.com${path}`, {
		...init,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
			...(init?.headers ?? {}),
		},
	});

	if (!response.ok) {
		const payload = await response.text();
		throw new Error(`GitHub request failed (${response.status}): ${payload}`);
	}

	return (await response.json()) as T;
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

export const commitFilesToRepo = async (
	token: string,
	repoFullName: string,
	branch: string,
	message: string,
	files: CommitFile[]
): Promise<CommitResult> => {
	const { owner, repo } = parseRepoFullName(repoFullName);

	const headSha = await getBranchHeadSha(token, owner, repo, branch);
	const headCommit = await getCommit(token, owner, repo, headSha);
	const existingPaths = await getTreePaths(token, owner, repo, headCommit.tree.sha);

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

		const blobSha = await createBlob(token, owner, repo, file);
		treeEntries.push({
			path: file.path,
			mode: "100644",
			type: "blob",
			sha: blobSha,
		});
	}

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
	await updateBranchRef(token, owner, repo, branch, commitSha);

	return {
		commitSha,
		commitUrl: `https://github.com/${owner}/${repo}/commit/${commitSha}`,
	};
};
