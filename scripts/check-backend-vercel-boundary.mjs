import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"..",
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

if (violations.length > 0) {
	console.error("check-backend-vercel-boundary: failed\n" + violations.join("\n"));
	process.exit(1);
}

console.log("check-backend-vercel-boundary: ok");
