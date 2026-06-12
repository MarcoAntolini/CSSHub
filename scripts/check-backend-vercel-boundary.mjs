import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoot = resolve(
	repoRoot,
	"apps/backend/api"
);

/** Imports that break Vercel serverless (workspace packages / monorepo paths outside lib/). */
const forbidden = [
	{
		pattern: /from\s+["']@\//,
		message: "use relative imports instead of the TypeScript @/ alias in Vercel API routes",
	},
	{
		pattern: /import\s*\(\s*["']@\//,
		message: "use relative imports instead of the TypeScript @/ alias in Vercel API routes",
	},
	{
		pattern: /from\s+["']@csshub\/shared["']/,
		message: "import shared code via lib/ shims (e.g. lib/oauth/schemas.js), not workspace package names in API routes",
	},
	{
		pattern: /from\s+["'][^"']*packages\/shared/,
		message: "import shared code via lib/ shims (e.g. lib/oauth/schemas.js), not packages/shared paths in API routes",
	},
];

const violations = [];

const requiredVercelConfigs = [
	{
		configPath: resolve(repoRoot, "vercel.json"),
		installCommand: "npm ci",
		functions: [
			{
				pattern: "apps/backend/api/**/*.ts",
				includeFiles: "{apps/backend/lib/**,packages/shared/src/**}",
			},
		],
	},
	{
		configPath: resolve(repoRoot, "apps/backend/vercel.json"),
		installCommand: "cd ../.. && npm ci",
		functions: [
			{
				pattern: "api/**/*.ts",
				includeFiles: "{lib/**,../../packages/shared/src/**}",
			},
		],
	},
];

const walk = (dir) => {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			walk(path);
			continue;
		}
		if (!entry.name.endsWith(".ts")) {
			continue;
		}
		const source = readFileSync(path, "utf8");
		for (const rule of forbidden) {
			if (rule.pattern.test(source)) {
				violations.push(`${path}: ${rule.message}`);
			}
		}
	}
};

walk(apiRoot);

for (const config of requiredVercelConfigs) {
	const vercelConfig = JSON.parse(readFileSync(config.configPath, "utf8"));

	if (vercelConfig.buildCommand != null) {
		violations.push(
			`${config.configPath}: buildCommand must be null for serverless-only API deploys`
		);
	}

	if (vercelConfig.installCommand !== config.installCommand) {
		violations.push(
			`${config.configPath}: installCommand must be npm ci (monorepo root when using apps/backend root)`
		);
	}

	for (const [pattern] of Object.entries(vercelConfig.functions ?? {})) {
		if (pattern.endsWith(".js")) {
			violations.push(
				`${config.configPath}: ${pattern} is invalid — Vercel function patterns must match .ts API sources`
			);
		}
	}

	for (const requiredFunction of config.functions) {
		const functionConfig = vercelConfig.functions?.[requiredFunction.pattern];
		if (functionConfig?.includeFiles !== requiredFunction.includeFiles) {
			violations.push(
				`${config.configPath}: ${requiredFunction.pattern} must include ${requiredFunction.includeFiles}`
			);
		}
	}
}

if (violations.length > 0) {
	console.error("check-backend-vercel-boundary: failed\n" + violations.join("\n"));
	process.exit(1);
}

console.log("check-backend-vercel-boundary: ok");
