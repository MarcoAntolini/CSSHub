import type { SubmissionPayload } from "@/shared/contracts";

export const resolveSubmissionCharacterCount = (
	payload: Pick<SubmissionPayload, "characterCount" | "code">
): number => payload.characterCount ?? payload.code.length;

export const normalizeSubmissionCharacterCount = (
	payload: SubmissionPayload
): SubmissionPayload => ({
	...payload,
	characterCount: resolveSubmissionCharacterCount(payload),
});
