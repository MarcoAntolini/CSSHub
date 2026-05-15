import type {
	AuthStatus,
	ExtensionSettings,
	Repo,
	SubmissionIngestionResponse,
	SubmissionPayload,
	SyncEvent,
} from "../shared/contracts";

export type LoadedState = {
	auth: AuthStatus;
	settings: ExtensionSettings;
	repos: Repo[];
	lastSubmission: SubmissionPayload | null;
	lastSubmissionAccepted: boolean | null;
	lastIngestion: SubmissionIngestionResponse | null;
	recentEvents: SyncEvent[];
};

export type UiNotice = {
	level: "success" | "warn" | "error";
	message: string;
};
