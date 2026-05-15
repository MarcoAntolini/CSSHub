import { readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = join(ROOT, "apps/extension/dist");
const BUDGETS_PATH = join(ROOT, "apps/extension/perf-budgets.json");

const budgets = JSON.parse(readFileSync(BUDGETS_PATH, "utf8"));

const gzipSizeKb = (bytes) => Math.round((gzipSync(bytes).length / 1024) * 10) / 10;

const readDistFiles = () => {
	const files = [];
	for (const name of readdirSync(DIST_DIR)) {
		if (!name.endsWith(".js")) {
			continue;
		}
		const path = join(DIST_DIR, name);
		if (!statSync(path).isFile()) {
			continue;
		}
		files.push({ name, path, bytes: readFileSync(path) });
	}
	const assetsDir = join(DIST_DIR, "assets");
	try {
		for (const name of readdirSync(assetsDir)) {
			if (!name.endsWith(".js")) {
				continue;
			}
			const path = join(assetsDir, name);
			if (!statSync(path).isFile()) {
				continue;
			}
			files.push({ name: `assets/${name}`, path, bytes: readFileSync(path) });
		}
	} catch {
		// no assets dir
	}
	return files;
};

const matchChunkBudget = (fileName, chunkBudgets) => {
	for (const [prefix, limitKb] of Object.entries(chunkBudgets)) {
		const base = fileName.replace(/^assets\//, "");
		if (base.startsWith(`${prefix}-`) || base === `${prefix}.js`) {
			return { label: prefix, limitKb };
		}
	}
	return null;
};

const files = readDistFiles();
if (files.length === 0) {
	console.error(`No JS files in ${DIST_DIR}. Run npm run build:extension:prod first.`);
	process.exit(1);
}

const rows = [];
const violations = [];

for (const file of files) {
	const gzipKb = gzipSizeKb(file.bytes);
	const rawKb = Math.round((file.bytes.length / 1024) * 10) / 10;
	rows.push({ file: file.name, rawKb, gzipKb });

	const entryLimit = budgets.entries?.[file.name];
	if (entryLimit !== undefined && gzipKb > entryLimit) {
		violations.push(`${file.name}: ${gzipKb} KB gzip > ${entryLimit} KB budget`);
	}

	const chunk = matchChunkBudget(file.name, budgets.chunks ?? {});
	if (chunk && gzipKb > chunk.limitKb) {
		violations.push(`${file.name}: ${gzipKb} KB gzip > ${chunk.limitKb} KB (${chunk.label})`);
	}
}

if (budgets.totalJsGzipMaxKb !== undefined) {
	const totalGzip = rows.reduce((sum, row) => sum + row.gzipKb, 0);
	const totalRounded = Math.round(totalGzip * 10) / 10;
	if (totalRounded > budgets.totalJsGzipMaxKb) {
		violations.push(
			`total JS: ${totalRounded} KB gzip > ${budgets.totalJsGzipMaxKb} KB budget`
		);
	}
}

console.log("Bundle sizes (production dist):");
console.log("file | raw KB | gzip KB");
for (const row of rows.sort((a, b) => a.file.localeCompare(b.file))) {
	console.log(`${row.file} | ${row.rawKb} | ${row.gzipKb}`);
}

if (violations.length > 0) {
	console.error("\nBudget violations:");
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}

console.log("\nAll bundle budgets passed.");
