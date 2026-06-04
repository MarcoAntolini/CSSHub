import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIST_PATH = resolve(CURRENT_DIR, "../../dist");
const SUBMISSION_SLO_MS = 8000;

const STORAGE_KEY = "csshub_state_v1";
const TOKEN_KEY = "csshub_github_token_v1";

const resolveChromiumExecutable = (): string => {
	const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
	if (fromEnv) {
		return fromEnv;
	}
	const defaultPath = chromium.executablePath();
	if (existsSync(defaultPath)) {
		return defaultPath;
	}
	const x64Fallback = defaultPath.replace("chrome-mac-arm64", "chrome-mac-x64");
	return existsSync(x64Fallback) ? x64Fallback : defaultPath;
};

type LaunchedExtension = {
	context: BrowserContext;
	extensionId: string;
	userDataDir: string;
};

const launchExtension = async (): Promise<LaunchedExtension> => {
	const userDataDir = mkdtempSync(resolve(tmpdir(), "csshub-perf-pw-"));
	const executablePath = resolveChromiumExecutable();
	const context = await chromium.launchPersistentContext(userDataDir, {
		executablePath,
		headless: !!process.env.CI,
		args: [
			`--disable-extensions-except=${EXTENSION_DIST_PATH}`,
			`--load-extension=${EXTENSION_DIST_PATH}`,
		],
	});

	let [serviceWorker] = context.serviceWorkers();
	if (!serviceWorker) {
		serviceWorker = await context.waitForEvent("serviceworker");
	}
	const extensionId = new URL(serviceWorker.url()).host;

	return { context, extensionId, userDataDir };
};

const closeExtension = async ({
	context,
	userDataDir,
}: LaunchedExtension): Promise<void> => {
	await context.close();
	rmSync(userDataDir, { recursive: true, force: true });
};

const seedAuthenticatedRepo = async (context: BrowserContext): Promise<void> => {
	const [serviceWorker] = context.serviceWorkers();
	await serviceWorker.evaluate(
		async ({ storageKey, tokenKey }) => {
			await chrome.storage.local.set({
				[storageKey]: {
					githubToken: null,
					auth: {
						isAuthenticated: true,
						username: "qa-user",
						method: "pat",
					},
					settings: {
						threshold: 95,
						selectedRepoFullName: "qa-user/csshub-perf",
						selectedBranch: "main",
						systemNotificationsEnabled: false,
						repositoryReadmeMode: "off",
					},
					lastSubmission: null,
					lastSubmissionAccepted: null,
					lastIngestion: null,
					recentEvents: [],
					lastSubmissionFingerprint: null,
				},
			});
			await chrome.storage.session.set({ [tokenKey]: "test-token" });
		},
		{ storageKey: STORAGE_KEY, tokenKey: TOKEN_KEY }
	);
};

const fulfillGithubApi = async (route: import("@playwright/test").Route): Promise<void> => {
	const url = route.request().url();
	const method = route.request().method();

	if (url.includes("/contents/")) {
		await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
		return;
	}
	if (url.includes("/git/trees/") && url.includes("recursive=1")) {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ tree: [] }),
		});
		return;
	}
	if (url.endsWith("/git/blobs") && method === "POST") {
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({ sha: "blob123" }),
		});
		return;
	}
	if (url.endsWith("/git/trees") && method === "POST") {
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({ sha: "tree123" }),
		});
		return;
	}
	if (url.endsWith("/git/commits") && method === "POST") {
		await route.fulfill({
			status: 201,
			contentType: "application/json",
			body: JSON.stringify({ sha: "commit123" }),
		});
		return;
	}
	if (url.includes("/git/ref/heads/")) {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ object: { sha: "head123" } }),
		});
		return;
	}
	if (url.includes("/git/commits/head123")) {
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ tree: { sha: "treeBase123" } }),
		});
		return;
	}
	if (url.includes("/git/refs/heads/") && method === "PATCH") {
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		return;
	}

	await route.fulfill({
		status: 200,
		contentType: "application/json",
		body: JSON.stringify({}),
	});
};

test("cssbattleSubmission commits within SLO with mocked GitHub", async () => {
	const launched = await launchExtension();
	try {
		await seedAuthenticatedRepo(launched.context);
		await launched.context.route("https://api.github.com/**", fulfillGithubApi);

		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/popup.html`);

		const started = Date.now();
		const response = await page.evaluate(async () => {
			return chrome.runtime.sendMessage({
				action: "cssbattleSubmission",
				payload: {
					challengeMode: "battle",
					challengeId: "99",
					challengeName: "Perf",
					battleGroup: "Battle #1",
					challengeLabel: "#99. Perf",
					challengeUrl: "https://cssbattle.dev/play/99",
					submittedAt: new Date().toISOString(),
					score: 500,
					matchPct: 99.5,
					code: "<div></div>",
					targetImage: null,
					resultImageDataUrl: null,
				},
			});
		});
		const elapsed = Date.now() - started;

		expect(response?.ok).toBe(true);
		expect(response?.data?.committed).toBe(true);
		expect(elapsed).toBeLessThan(SUBMISSION_SLO_MS);
	} finally {
		await closeExtension(launched);
	}
});
