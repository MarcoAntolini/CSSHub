export type CommitBlobFile = {
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
