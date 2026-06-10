export class GithubApiError extends Error {
	readonly status: number;
	readonly detail: string;

	constructor(status: number, detail: string) {
		super(`GitHub request failed (${status}): ${detail}`);
		this.name = "GithubApiError";
		this.status = status;
		this.detail = detail;
	}
}

export const getGithubErrorStatus = (error: unknown): number | null => {
	if (error instanceof GithubApiError) {
		return error.status;
	}
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

export const isRetriableGithubConflict = (error: unknown): boolean => {
	const status = getGithubErrorStatus(error);
	return status === 409 || status === 422;
};
