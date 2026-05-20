import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(backendRoot, "../..");
const source = resolve(repoRoot, "packages/shared/dist");
const target = resolve(backendRoot, "lib/shared-dist");
const builtEntry = resolve(source, "oauth/schemas.js");

if (!existsSync(builtEntry)) {
	console.error(
		"sync-shared-dist: missing packages/shared/dist — run: npm run build --workspace @csshub/shared"
	);
	process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(
	"sync-shared-dist: copied packages/shared/dist -> apps/backend/lib/shared-dist"
);
