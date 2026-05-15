import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
	{
		ignores: [
			"node_modules/**",
			"apps/**/dist/**",
			"apps/**/test-results/**",
			".cursor/**",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrors: "none",
				},
			],
		},
	},
	{
		files: ["apps/extension/**/*.{ts,tsx}"],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.webextensions,
			},
		},
		plugins: {
			"react-hooks": reactHooks,
		},
		rules: {
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "warn",
		},
	},
	{
		files: ["apps/backend/**/*.{ts,tsx}", "scripts/**/*.mjs"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	}
);
