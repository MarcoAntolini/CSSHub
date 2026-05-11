import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
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
			},
		},
	},
	publicDir: "public",
});
