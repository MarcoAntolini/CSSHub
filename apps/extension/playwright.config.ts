import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 45_000,
	expect: {
		timeout: 10_000,
	},
	use: {
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},
	reporter: [["list"]],
});
