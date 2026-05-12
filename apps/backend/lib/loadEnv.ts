import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

let envLoaded = false;

export const ensureBackendEnvLoaded = (): void => {
	if (envLoaded) {
		return;
	}
	envLoaded = true;

	// Local dev fallback: load env files from backend workspace when process env is empty.
	loadDotenv({ path: resolve(process.cwd(), ".env.local"), override: false });
	loadDotenv({ path: resolve(process.cwd(), ".env"), override: false });
};
