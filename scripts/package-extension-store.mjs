#!/usr/bin/env node
/**
 * Zip extension dist/ for Chrome Web Store upload.
 * manifest.json must be at the zip root (zip contents of dist/, not the dist folder itself).
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(process.argv[2] ?? join(repoRoot, "apps/extension/dist"));
const manifestPath = join(distDir, "manifest.json");

if (!existsSync(manifestPath)) {
	console.error(
		`package-extension-store: missing ${manifestPath}\n` +
			"Build first (npm run build:extension:prod) or unzip the extension-dist-production CI artifact into apps/extension/dist."
	);
	process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const version = manifest.version;
if (!version) {
	console.error("package-extension-store: manifest.json has no version field");
	process.exit(1);
}

const outDir = join(repoRoot, "release");
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `csshub-${version}.zip`);
if (existsSync(zipPath)) {
	rmSync(zipPath);
}

// -j false: include files at zip root; cd into dist so paths are manifest.json, background.js, ...
execSync(`zip -r -q "${zipPath}" .`, { cwd: distDir, stdio: "inherit" });

console.log(`Created ${zipPath}`);
console.log("Upload this zip in Chrome Web Store → Package → Upload new package.");
