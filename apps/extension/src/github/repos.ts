import { branchSchema, repoSchema, type Branch, type Repo } from "@/shared/contracts";
import { githubRequest, parseRepoFullName } from "./transport";

type GitRefResponse = {
	object: {
		sha: string;
	};
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

export const getBranchHeadSha = async (
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

export const createBranch = async (
	token: string,
	repoFullName: string,
	newBranch: string,
	fromBranch: string
): Promise<Branch> => {
	const { owner, repo } = parseRepoFullName(repoFullName);
	const fromSha = await getBranchHeadSha(token, owner, repo, fromBranch);
	await githubRequest(token, `/repos/${owner}/${repo}/git/refs`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			ref: `refs/heads/${newBranch}`,
			sha: fromSha,
		}),
	});
	return branchSchema.parse({
		name: newBranch,
	});
};
