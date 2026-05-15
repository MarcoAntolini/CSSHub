import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const DEFAULT_BACKEND_URL = "http://localhost:3000";

type ExtensionManifest = {
	host_permissions?: string[];
	key?: string;
	[key: string]: unknown;
};

const getBackendBaseUrl = (mode: string, env: Record<string, string>): string => {
	const raw = env.VITE_OAUTH_BACKEND_BASE_URL?.trim();
	if (raw) {
		return raw.replace(/\/+$/g, "");
	}
	if (mode === "production") {
		throw new Error(
			"Missing VITE_OAUTH_BACKEND_BASE_URL for production build"
		);
	}
	return DEFAULT_BACKEND_URL;
};

const toHostPermission = (baseUrl: string): string => {
	const parsed = new URL(baseUrl);
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new Error("VITE_OAUTH_BACKEND_BASE_URL must be http/https");
	}
	return `${parsed.origin}/*`;
};

const isLocalhostHost = (host: string): boolean =>
	host === "localhost" || host === "127.0.0.1" || host === "::1";

const assertNoLocalhostInProduction = (baseUrl: string, mode: string): void => {
	if (mode !== "production") {
		return;
	}
	const parsed = new URL(baseUrl);
	if (isLocalhostHost(parsed.hostname)) {
		throw new Error(
			"Production build cannot use localhost for VITE_OAUTH_BACKEND_BASE_URL"
		);
	}
};

const getManifestKey = (env: Record<string, string>): string | null => {
	const raw = env.EXTENSION_MANIFEST_KEY?.trim();
	if (!raw) {
		return null;
	}
	const compact = raw
		.replace(/^['"]|['"]$/g, "")
		.replace(/\s+/g, "");
	if (compact.includes("BEGIN")) {
		throw new Error(
			"EXTENSION_MANIFEST_KEY must be manifest key value, not PEM key contents"
		);
	}
	if (compact.includes("AQEFAAS") || compact.startsWith("MIIE")) {
		throw new Error(
			"EXTENSION_MANIFEST_KEY appears to be a private key. Use the extension public key (manifest key) instead."
		);
	}
	if (!/^[A-Za-z0-9+/=]+$/.test(compact)) {
		throw new Error(
			"EXTENSION_MANIFEST_KEY contains invalid characters. Copy only base64 public key (no prompt symbols like %)."
		);
	}
	return compact;
};

const manifestHostPlugin = (
	mode: string,
	backendBaseUrl: string,
	manifestKey: string | null
): Plugin => ({
	name: "manifest-host-permission-injector",
	apply: "build",
	async closeBundle() {
		const manifestPath = resolve(__dirname, "dist/manifest.json");
		const raw = await readFile(manifestPath, "utf-8");
		const manifest = JSON.parse(raw) as ExtensionManifest;
		const existing = manifest.host_permissions ?? [];
		const backendPermission = toHostPermission(backendBaseUrl);
		const nextPermissions = Array.from(new Set([...existing, backendPermission]));
		manifest.host_permissions = nextPermissions;
		if (manifestKey) {
			manifest.key = manifestKey;
		}
		assertNoLocalhostInProduction(backendBaseUrl, mode);
		await writeFile(manifestPath, JSON.stringify(manifest, null, "\t"));
	},
});

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, __dirname, "");
	const backendBaseUrl = getBackendBaseUrl(mode, env);
	const manifestKey = getManifestKey(env);
	return {
		plugins: [react(), manifestHostPlugin(mode, backendBaseUrl, manifestKey)],
		build: {
			emptyOutDir: true,
			outDir: "dist",
			rollupOptions: {
				input: {
					popup: resolve(__dirname, "popup.html"),
					settings: resolve(__dirname, "settings.html"),
					background: resolve(__dirname, "src/background.ts"),
					contentScript: resolve(__dirname, "src/contentScript.ts"),
				},
				output: {
					entryFileNames: "[name].js",
					chunkFileNames: "assets/[name]-[hash].js",
					assetFileNames: "[name].[ext]",
					manualChunks(id) {
						if (!id.includes("node_modules")) {
							return undefined;
						}
						if (id.includes("sonner")) {
							return "vendor-sonner";
						}
						if (
							id.includes("react-dom") ||
							id.includes("/react/") ||
							id.endsWith("/react")
						) {
							return "vendor-react";
						}
						return "vendor";
					},
				},
			},
		},
		publicDir: "public",
	};
});
