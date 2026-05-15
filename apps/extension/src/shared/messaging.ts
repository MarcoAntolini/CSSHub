import type { z } from "zod";
import { popupToBackgroundMessageSchema } from "@csshub/shared";

export type BackgroundResponse<T = unknown> =
	| { ok: true; data?: T }
	| { ok: false; error: string };

export class BackgroundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BackgroundError";
	}
}

export const isBackgroundResponse = (value: unknown): value is BackgroundResponse => {
	if (!value || typeof value !== "object" || !("ok" in value)) {
		return false;
	}
	const response = value as BackgroundResponse;
	if (response.ok === true) {
		return true;
	}
	return response.ok === false && typeof response.error === "string";
};

export const getBackgroundErrorMessage = (
	response: unknown,
	fallback: string
): string => {
	if (
		response &&
		typeof response === "object" &&
		"ok" in response &&
		response.ok === false &&
		"error" in response &&
		typeof response.error === "string"
	) {
		return response.error;
	}
	return fallback;
};

export const parseBackgroundOk = <T>(
	response: unknown,
	schema: z.ZodType<T>,
	fallbackError: string
): T => {
	if (!isBackgroundResponse(response) || !response.ok) {
		throw new BackgroundError(getBackgroundErrorMessage(response, fallbackError));
	}
	const parsed = schema.safeParse(response.data);
	if (!parsed.success) {
		throw new BackgroundError(fallbackError);
	}
	return parsed.data;
};

export const parseBackgroundOkVoid = (
	response: unknown,
	fallbackError: string
): void => {
	if (!isBackgroundResponse(response) || !response.ok) {
		throw new BackgroundError(getBackgroundErrorMessage(response, fallbackError));
	}
};

export const sendBackgroundMessage = async (
	message: unknown
): Promise<unknown> => {
	const parsed = popupToBackgroundMessageSchema.parse(message);
	return chrome.runtime.sendMessage(parsed);
};
