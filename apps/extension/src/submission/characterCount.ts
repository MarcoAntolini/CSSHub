import type { SubmissionPayload } from "@/shared/contracts";

export type SubmissionPayloadWithCharacterCount = SubmissionPayload & {
	characterCount: number;
};

export const resolveSubmissionCharacterCount = (
	payload: Pick<SubmissionPayload, "characterCount" | "code">
): number => payload.characterCount ?? payload.code.length;

export const normalizeSubmissionCharacterCount = (
	payload: SubmissionPayload
): SubmissionPayloadWithCharacterCount => ({
	...payload,
	characterCount: resolveSubmissionCharacterCount(payload),
});
