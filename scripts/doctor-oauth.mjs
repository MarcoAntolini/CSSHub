const defaultUrl = "http://localhost:3000/api/oauth/github/health";
const healthUrl = process.env.OAUTH_HEALTH_URL?.trim() || defaultUrl;

const toErrorMessage = (error) => {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
};

const run = async () => {
	console.log(`Checking OAuth backend health: ${healthUrl}`);

	let response;
	try {
		response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
	} catch (error) {
		console.error(`Unable to reach OAuth health endpoint: ${toErrorMessage(error)}`);
		console.error("Make sure backend dev is running (npm run dev:backend or npm run dev).");
		process.exit(1);
	}

	let payload = null;
	try {
		payload = await response.json();
	} catch (_error) {
		console.error(`Invalid JSON response from OAuth health endpoint (status ${response.status}).`);
		process.exit(1);
	}

	const missingRequired = Array.isArray(payload?.missingRequired)
		? payload.missingRequired.filter((entry) => typeof entry === "string")
		: [];

	if (!response.ok || payload?.ok !== true) {
		console.error(`OAuth health check failed (status ${response.status}).`);
		if (missingRequired.length > 0) {
			console.error(`Missing required env vars: ${missingRequired.join(", ")}`);
		}
		if (payload?.required && typeof payload.required === "object") {
			console.error(`Required env status: ${JSON.stringify(payload.required)}`);
		}
		process.exit(1);
	}

	console.log("OAuth health check passed.");
	console.log(`Required env status: ${JSON.stringify(payload.required)}`);
};

await run();
