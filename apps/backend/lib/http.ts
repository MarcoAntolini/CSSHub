import type { VercelRequest, VercelResponse } from "@vercel/node";

export const rejectMethod = (
	req: VercelRequest,
	res: VercelResponse,
	method: "POST" | "GET"
): boolean => {
	if (req.method !== method) {
		res.status(405).json({ error: "Method not allowed" });
		return true;
	}
	return false;
};

export const getClientIp = (req: VercelRequest): string => {
	const forwardedFor = req.headers["x-forwarded-for"];
	if (typeof forwardedFor === "string") {
		const firstIp = forwardedFor.split(",")[0]?.trim();
		if (firstIp) {
			return firstIp;
		}
	}
	return "unknown";
};
