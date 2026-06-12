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
		message: "use lib/shared-dist (npm run vercel:prepare -w @csshub/backend), not workspace/monorepo imports",
	},
	{
		pattern: /from\s+["'][^"']*packages\/shared/,
		message: "use lib/shared-dist (npm run vercel:prepare -w @csshub/backend), not workspace/monorepo imports",
	},
];

const violations = [];

const requiredVercelConfigs = [
	{
		configPath: resolve(repoRoot, "vercel.json"),
		buildCommand: "npm run vercel:prepare --workspace @csshub/backend",
		functions: [
			{
				pattern: "apps/backend/api/**/*.ts",
				includeFiles: "apps/backend/lib/**",
			},
		],
	},
	{
		configPath: resolve(repoRoot, "apps/backend/vercel.json"),
		buildCommand: "npm run vercel:prepare",
		functions: [
			{
				pattern: "api/**/*.ts",
				includeFiles: "lib/**",
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

	if (vercelConfig.buildCommand !== config.buildCommand) {
		violations.push(
			`${config.configPath}: buildCommand must be "${config.buildCommand}"`
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
