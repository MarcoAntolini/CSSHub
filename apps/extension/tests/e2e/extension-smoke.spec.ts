import {
	expect,
	test,
	chromium,
	type BrowserContext,
	type Page,
} from "@playwright/test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const EXTENSION_DIST_PATH = resolve(CURRENT_DIR, "../../dist");
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

type SeedState = {
	githubToken: string | null;
	auth: {
		isAuthenticated: boolean;
		username: string | null;
		method: "device" | "web" | "pat" | null;
	};
	settings: {
		threshold: number;
		selectedRepoFullName: string | null;
		selectedBranch: string | null;
		systemNotificationsEnabled: boolean;
		repositoryReadmeMode: "off" | "managed-section" | "full";
	};
	recentEvents: Array<{
		id: string;
		timestamp: string;
		level: "info" | "warn" | "error";
		message: string;
		code?: string;
		commitUrl: string | null;
	}>;
};

const STORAGE_KEY = "csshub_state_v1";
const TOKEN_KEY = "csshub_github_token_v1";

const launchExtension = async (): Promise<LaunchedExtension> => {
	const userDataDir = mkdtempSync(resolve(tmpdir(), "csshub-pw-"));
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

const getServiceWorker = async (context: BrowserContext) => {
	let [serviceWorker] = context.serviceWorkers();
	if (!serviceWorker) {
		serviceWorker = await context.waitForEvent("serviceworker");
	}
	return serviceWorker;
};

const seedState = async (
	context: BrowserContext,
	seed: SeedState
): Promise<void> => {
	const serviceWorker = await getServiceWorker(context);
	await serviceWorker.evaluate(
		async ({ storageKey, tokenKey, input }) => {
			const payload = {
				githubToken: null,
				auth: input.auth,
				settings: input.settings,
				lastSubmission: null,
				lastSubmissionAccepted: null,
				lastIngestion: null,
				recentEvents: input.recentEvents,
				lastSubmissionFingerprint: null,
			};
			await chrome.storage.local.set({ [storageKey]: payload });
			if (input.githubToken) {
				await chrome.storage.session.set({ [tokenKey]: input.githubToken });
				return;
			}
			await chrome.storage.session.remove(tokenKey);
		},
		{
			storageKey: STORAGE_KEY,
			tokenKey: TOKEN_KEY,
			input: seed,
		}
	);
};

const readStateFromPage = async (page: Page): Promise<SeedState> => {
	return page.evaluate(
		async ({ storageKey, tokenKey }) => {
			const local = await chrome.storage.local.get(storageKey);
			const session = await chrome.storage.session.get(tokenKey);
			const state = local[storageKey] as Omit<SeedState, "githubToken">;
			const token =
				typeof session[tokenKey] === "string"
					? (session[tokenKey] as string)
					: null;
			return { ...state, githubToken: token };
		},
		{
			storageKey: STORAGE_KEY,
			tokenKey: TOKEN_KEY,
		}
	);
};

test("popup renders unauthenticated CTA", async () => {
	const launched = await launchExtension();
	try {
		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/popup.html`);

		await expect(page.getByRole("heading", { name: "CssHub" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Open Settings" })
		).toBeVisible();
		await expect(
			page.getByText("Sign in and pick a repo in Settings.")
		).toBeVisible();
	} finally {
		await closeExtension(launched);
	}
});

test("popup defaults to dark theme and persists light mode preference", async () => {
	const launched = await launchExtension();
	try {
		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/popup.html`);

		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		await page.getByRole("button", { name: "Switch to light mode" }).click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
		await page.getByRole("button", { name: "Switch to dark mode" }).click();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	} finally {
		await closeExtension(launched);
	}
});

test("settings renders auth section for signed-out users", async () => {
	const launched = await launchExtension();
	try {
		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/settings.html`);

		await expect(page.getByRole("heading", { name: "CssHub" })).toBeVisible();
		await expect(page.getByRole("heading", { name: "GitHub account" })).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Continue with GitHub" })
		).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Start device sign-in" })
		).toBeVisible();
	} finally {
		await closeExtension(launched);
	}
});

test("settings supports notification toggle and clear log for signed-in users", async () => {
	const launched = await launchExtension();
	try {
		await seedState(launched.context, {
			githubToken: "test-token",
			auth: {
				isAuthenticated: true,
				username: "qa-user",
				method: "pat",
			},
			settings: {
				threshold: 95,
				selectedRepoFullName: null,
				selectedBranch: null,
				systemNotificationsEnabled: true,
				repositoryReadmeMode: "managed-section",
			},
			recentEvents: [
				{
					id: "evt-1",
					timestamp: new Date().toISOString(),
					level: "warn",
					code: "SYNC_SKIPPED_THRESHOLD",
					message: "Submission below threshold.",
					commitUrl: null,
				},
			],
		});
		await launched.context.route("https://api.github.com/**", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({
					message: "Unauthorized",
				}),
			});
		});

		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/settings.html`);

		await expect(page.getByText("Signed in as")).toBeVisible();
		await expect(page.getByText("No repository selected for sync.")).toBeVisible();

		const notificationsToggle = page.locator("#system-notifications-toggle");
		await expect(notificationsToggle).toBeChecked();
		await page
			.locator('label[for="system-notifications-toggle"] .switch-slider')
			.click();
		await expect(notificationsToggle).not.toBeChecked();

		const clearLogButton = page.getByRole("button", { name: "Clear log" });
		await expect(clearLogButton).toBeEnabled();
		await clearLogButton.click();
		await expect(page.getByText("No events yet.")).toBeVisible();
		await expect(clearLogButton).toBeDisabled();

		const nextState = await readStateFromPage(page);
		expect(nextState.settings.systemNotificationsEnabled).toBe(false);
		expect(nextState.recentEvents).toHaveLength(0);
	} finally {
		await closeExtension(launched);
	}
});

test("popup shows setup prompt when authenticated without repository", async () => {
	const launched = await launchExtension();
	try {
		await seedState(launched.context, {
			githubToken: "test-token",
			auth: {
				isAuthenticated: true,
				username: "qa-user",
				method: "pat",
			},
			settings: {
				threshold: 95,
				selectedRepoFullName: null,
				selectedBranch: null,
				systemNotificationsEnabled: true,
				repositoryReadmeMode: "managed-section",
			},
			recentEvents: [],
		});
		await launched.context.route("https://api.github.com/**", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({ message: "Unauthorized" }),
			});
		});

		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/popup.html`);

		await expect(
			page.getByRole("heading", { name: "Submission flow" })
		).toBeVisible();
		await expect(page.getByText("No repo selected.")).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Set up in Settings" })
		).toBeVisible();
		await expect(page.getByText("Match threshold")).toHaveCount(0);
	} finally {
		await closeExtension(launched);
	}
});

test("settings disconnect clears auth session", async () => {
	const launched = await launchExtension();
	try {
		await seedState(launched.context, {
			githubToken: "test-token",
			auth: {
				isAuthenticated: true,
				username: "qa-user",
				method: "pat",
			},
			settings: {
				threshold: 95,
				selectedRepoFullName: null,
				selectedBranch: null,
				systemNotificationsEnabled: true,
				repositoryReadmeMode: "managed-section",
			},
			recentEvents: [],
		});
		await launched.context.route("https://api.github.com/**", async (route) => {
			await route.fulfill({
				status: 401,
				contentType: "application/json",
				body: JSON.stringify({ message: "Unauthorized" }),
			});
		});

		const page = await launched.context.newPage();
		await page.goto(`chrome-extension://${launched.extensionId}/settings.html`);
		const disconnectButton = page.getByRole("button", {
			name: "Disconnect GitHub",
		});
		await expect(disconnectButton).toBeVisible();
		await disconnectButton.click();

		await expect(
			page.getByRole("button", { name: "Continue with GitHub" })
		).toBeVisible();
		await expect(disconnectButton).toHaveCount(0);

		const nextState = await readStateFromPage(page);
		expect(nextState.githubToken).toBeNull();
		expect(nextState.auth.isAuthenticated).toBe(false);
		expect(nextState.auth.username).toBeNull();
	} finally {
		await closeExtension(launched);
	}
});
