import type {
	AuthStatus,
	ExtensionSettings,
	PopupToBackgroundMessage,
	SubmissionIngestionResponse,
	SyncEvent,
} from "@/shared/contracts";

export type StoredState = {
	githubToken: string | null;
	auth: AuthStatus;
	settings: ExtensionSettings;
	lastSubmission: Extract<PopupToBackgroundMessage, { action: "cssbattleSubmission" }>["payload"] | null;
	lastSubmissionAccepted: boolean | null;
	lastIngestion: SubmissionIngestionResponse | null;
	recentEvents: SyncEvent[];
	lastSubmissionFingerprint: string | null;
};
