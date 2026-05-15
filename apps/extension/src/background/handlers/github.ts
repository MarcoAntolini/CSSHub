import { createUserRepo, createBranch, listBranches, listUserRepos } from "../../githubClient";
import { saveStoredState } from "../../storage";
import { getAuthenticatedState, type Handler } from "./types";

export const handleListRepos: Handler<"listRepos"> = async (_data, sendResponse) => {
	const state = await getAuthenticatedState(sendResponse);
	if (!state) {
		return;
	}

	const repos = await listUserRepos(state.githubToken);
	sendResponse({ ok: true, data: repos });
};

export const handleListBranches: Handler<"listBranches"> = async (data, sendResponse) => {
	const state = await getAuthenticatedState(sendResponse);
	if (!state) {
		return;
	}
	const branches = await listBranches(state.githubToken, data.repoFullName);
	sendResponse({ ok: true, data: branches });
};

export const handleCreateRepo: Handler<"createRepo"> = async (data, sendResponse) => {
	const state = await getAuthenticatedState(sendResponse);
	if (!state) {
		return;
	}

	const repo = await createUserRepo(state.githubToken, data.name, data.private);
	await saveStoredState({
		...state,
		settings: {
			...state.settings,
			selectedRepoFullName: repo.fullName,
			selectedBranch: repo.defaultBranch,
		},
	});
	sendResponse({ ok: true, data: repo });
};

export const handleCreateBranch: Handler<"createBranch"> = async (data, sendResponse) => {
	const state = await getAuthenticatedState(sendResponse);
	if (!state) {
		return;
	}

	const branch = await createBranch(
		state.githubToken,
		data.repoFullName,
		data.newBranch,
		data.fromBranch
	);
	await saveStoredState({
		...state,
		settings: {
			...state.settings,
			selectedRepoFullName: data.repoFullName,
			selectedBranch: branch.name,
		},
	});
	sendResponse({ ok: true, data: branch });
};
