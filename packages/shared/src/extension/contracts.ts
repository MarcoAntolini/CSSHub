import { z } from "zod";
import { backgroundEventCodeSchema, syncIngestionEventCodeSchema } from "./syncEventCodes.js";

export const contentScriptTabMessageSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("getElementPositionAndDimensions"),
		selector: z.string().min(1),
	}),
]);

export type ContentScriptTabMessage = z.infer<typeof contentScriptTabMessageSchema>;

export const elementDimensionsSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
});

export type ElementDimensions = z.infer<typeof elementDimensionsSchema>;

export const captureElementMessageSchema = z.object({
	action: z.literal("captureElement"),
	selector: z.string().min(1).optional(),
	dimensions: elementDimensionsSchema.optional(),
});

/** One coordinated preview capture (child frames, then at most one tab screenshot). */
export const capturePreviewMessageSchema = z.object({
	action: z.literal("capturePreview"),
	dimensions: elementDimensionsSchema.optional(),
});

export const fetchRemoteImageMessageSchema = z.object({
	action: z.literal("fetchRemoteImage"),
	url: z.string().url(),
});

export const repoSchema = z.object({
	id: z.number(),
	name: z.string(),
	fullName: z.string(),
	owner: z.string(),
	private: z.boolean(),
	defaultBranch: z.string(),
});

export type Repo = z.infer<typeof repoSchema>;

export const branchSchema = z.object({
	name: z.string().min(1),
});

export type Branch = z.infer<typeof branchSchema>;

export const repositoryReadmeModeSchema = z.enum(["off", "managed-section", "full"]);

export type RepositoryReadmeMode = z.infer<typeof repositoryReadmeModeSchema>;

export const extensionSettingsSchema = z.object({
	threshold: z.number().min(0).max(100),
	selectedRepoFullName: z.string().nullable(),
	selectedBranch: z.string().nullable(),
	systemNotificationsEnabled: z.boolean().default(true),
	repositoryReadmeMode: repositoryReadmeModeSchema.default("managed-section"),
});

export type ExtensionSettings = z.infer<typeof extensionSettingsSchema>;

export const authStatusSchema = z.object({
	isAuthenticated: z.boolean(),
	username: z.string().nullable(),
	method: z.enum(["device", "web", "pat"]).nullable(),
});

export type AuthStatus = z.infer<typeof authStatusSchema>;

export const submissionPayloadSchema = z
	.object({
		challengeMode: z.enum(["battle", "daily"]),
		challengeId: z.string().min(1),
		challengeName: z.string().min(1),
		challengeUrl: z.string().url().optional(),
		battleGroup: z.string().min(1).optional(),
		challengeLabel: z.string().min(1).optional(),
		dailyDateIso: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/)
			.optional(),
		dailyDateLabel: z.string().min(1).optional(),
		submittedAt: z.string(),
		score: z.number().nullable(),
		matchPct: z.number().min(0).max(100).nullable(),
		code: z.string(),
		targetImage: z
			.object({
				type: z.enum(["dataUrl", "url"]),
				value: z.string().min(1),
			})
			.nullable(),
		resultImageDataUrl: z.string().startsWith("data:image/").nullable(),
	})
	.superRefine((payload, ctx) => {
		if (payload.challengeMode === "battle") {
			if (!payload.battleGroup) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "battleGroup is required for battle mode",
					path: ["battleGroup"],
				});
			}
			if (!payload.challengeLabel) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "challengeLabel is required for battle mode",
					path: ["challengeLabel"],
				});
			}
		}
		if (payload.challengeMode === "daily") {
			if (!payload.dailyDateIso) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "dailyDateIso is required for daily mode",
					path: ["dailyDateIso"],
				});
			}
			if (!payload.dailyDateLabel) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					message: "dailyDateLabel is required for daily mode",
					path: ["dailyDateLabel"],
				});
			}
		}
	});

export type SubmissionPayload = z.infer<typeof submissionPayloadSchema>;

export const syncEventSchema = z.object({
	id: z.string(),
	timestamp: z.string(),
	level: z.enum(["info", "warn", "error"]),
	code: backgroundEventCodeSchema.optional(),
	message: z.string(),
	commitUrl: z.string().url().nullable(),
});

export type SyncEvent = z.infer<typeof syncEventSchema>;

export const popupToBackgroundMessageSchema = z.discriminatedUnion("action", [
	captureElementMessageSchema,
	capturePreviewMessageSchema,
	fetchRemoteImageMessageSchema,
	z.object({
		action: z.literal("getExtensionState"),
		refreshRepos: z.boolean().optional(),
	}),
	z.object({
		action: z.literal("saveSettings"),
		settings: extensionSettingsSchema,
	}),
	z.object({
		action: z.literal("startGithubDeviceFlow"),
	}),
	z.object({
		action: z.literal("pollGithubDeviceFlow"),
		deviceCode: z.string().min(1),
	}),
	z.object({
		action: z.literal("startGithubWebFlow"),
	}),
	z.object({
		action: z.literal("loginWithPat"),
		token: z.string().min(1),
	}),
	z.object({
		action: z.literal("logoutGithub"),
	}),
	z.object({
		action: z.literal("listRepos"),
	}),
	z.object({
		action: z.literal("listBranches"),
		repoFullName: z.string().min(1),
	}),
	z.object({
		action: z.literal("createBranch"),
		repoFullName: z.string().min(1),
		newBranch: z.string().min(1),
		fromBranch: z.string().min(1),
	}),
	z.object({
		action: z.literal("createRepo"),
		name: z.string().min(1),
		private: z.boolean(),
	}),
	z.object({
		action: z.literal("clearRecentEvents"),
	}),
	z.object({
		action: z.literal("extractCssbattleEditorCode"),
	}),
	z.object({
		action: z.literal("submissionProcessingStarted"),
	}),
	z.object({
		action: z.literal("clearActionBadge"),
	}),
	z.object({
		action: z.literal("cssbattleSubmission"),
		payload: submissionPayloadSchema,
	}),
]);

export type PopupToBackgroundMessage = z.infer<
	typeof popupToBackgroundMessageSchema
>;

export const deviceFlowStartResponseSchema = z.object({
	deviceCode: z.string(),
	userCode: z.string(),
	verificationUri: z.string().url(),
	verificationUriComplete: z.string().url().nullable(),
	expiresIn: z.number().positive(),
	interval: z.number().positive(),
});

export type DeviceFlowStartResponse = z.infer<
	typeof deviceFlowStartResponseSchema
>;

export const submissionIngestionResponseSchema = z.object({
	accepted: z.boolean(),
	threshold: z.number().min(0).max(100),
	reason: z.string(),
	code: syncIngestionEventCodeSchema.or(backgroundEventCodeSchema).optional(),
	committed: z.boolean(),
	commitUrl: z.string().url().nullable(),
});

export {
	backgroundEventCodeSchema,
	syncIngestionEventCodeSchema,
	toneFromSyncEventCode,
	type BackgroundEventCode,
	type StatusTone,
	type SyncIngestionEventCode,
} from "./syncEventCodes.js";

export type SubmissionIngestionResponse = z.infer<
	typeof submissionIngestionResponseSchema
>;

export const extensionStateResponseSchema = z.object({
	auth: authStatusSchema,
	settings: extensionSettingsSchema,
	repos: z.array(repoSchema),
	lastSubmission: submissionPayloadSchema.nullable(),
	lastSubmissionAccepted: z.boolean().nullable(),
	lastIngestion: submissionIngestionResponseSchema.nullable(),
	recentEvents: z.array(syncEventSchema),
});

export type ExtensionStateResponse = z.infer<typeof extensionStateResponseSchema>;
