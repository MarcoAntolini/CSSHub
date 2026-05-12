import type { VercelRequest, VercelResponse } from "@vercel/node";

const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS = "Content-Type";

const resolveAllowOrigin = (originHeader: string | undefined): string => {
	if (!originHeader) {
		return "*";
	}
	if (originHeader.startsWith("chrome-extension://")) {
		return originHeader;
	}
	return "null";
};

export const setCorsHeaders = (
	req: VercelRequest,
	res: VercelResponse
): void => {
	const origin =
		typeof req.headers.origin === "string" ? req.headers.origin : undefined;
	res.setHeader("Access-Control-Allow-Origin", resolveAllowOrigin(origin));
	res.setHeader("Access-Control-Allow-Methods", ALLOWED_METHODS);
	res.setHeader("Access-Control-Allow-Headers", ALLOWED_HEADERS);
	res.setHeader("Vary", "Origin");
};

export const handleCorsPreflight = (
	req: VercelRequest,
	res: VercelResponse
): boolean => {
	setCorsHeaders(req, res);
	if (req.method === "OPTIONS") {
		res.status(204).send("");
		return true;
	}
	return false;
};
