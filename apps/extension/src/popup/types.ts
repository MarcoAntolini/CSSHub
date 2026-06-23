import type {
	AuthStatus,
	ExtensionSettings,
	SubmissionIngestionResponse,
	SubmissionPayload,
} from "@/shared/contracts";
import type { StatusTone } from "@/shared/eventTone";

export type SubmissionCardView = {
	title: string;
	meta: string;
	tone: StatusTone;
	statusText: string;
	reason: string;
	commitUrl?: string | null;
	processing?: boolean;
};

export type PopupState = {
	auth: AuthStatus;
	settings: ExtensionSettings;
	lastSubmission: SubmissionPayload | null;
	lastSubmissionAccepted: boolean | null;
	lastIngestion: SubmissionIngestionResponse | null;
	submissionProcessing: boolean;
};
