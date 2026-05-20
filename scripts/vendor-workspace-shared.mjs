import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(repoRoot, "packages/shared");
const target = resolve(repoRoot, "node_modules/@csshub/shared");
const builtEntry = resolve(source, "dist/index.js");

if (!existsSync(builtEntry)) {
	console.error(
		"vendor-workspace-shared: missing dist/index.js — run: npm run build --workspace @csshub/shared"
	);
	process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, {
	recursive: true,
	filter: (path) => {
		const relative = path.slice(source.length + 1);
		if (!relative) {
			return true;
		}
		return (
			!relative.startsWith("node_modules/") &&
			relative !== "node_modules" &&
			!relative.startsWith("tests/") &&
			relative !== "tests"
		);
	},
});

console.log(
	"vendor-workspace-shared: materialized packages/shared at node_modules/@csshub/shared"
);
