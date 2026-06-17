import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const SECRET_PATTERNS = [
	"ghp_[A-Za-z0-9]{36}",
	"github_pat_[A-Za-z0-9_]{20,}",
	"AKIA[0-9A-Z]{16}",
	"AIza[0-9A-Za-z\\-_]{35}",
	"xox[baprs]-[0-9A-Za-z-]{10,}",
];

const run = (command, args) => {
	const useShell = process.platform === "win32" && command === "npm";
	const result = spawnSync(command, args, {
		encoding: "utf8",
		shell: useShell,
		stdio: ["ignore", "pipe", "pipe"],
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
};

const isStrictMode = process.argv.includes("--strict");
const emitJson = process.argv.includes("--json");
const outputPathArgIndex = process.argv.indexOf("--output");
const outputPath =
	outputPathArgIndex >= 0 ? process.argv[outputPathArgIndex + 1] : null;

const log = (message) => {
	if (!emitJson) {
		console.log(message);
	}
};

const runAudit = () => {
	log("== Dependency audit ==");
	const result = run("npm", ["audit", "--workspaces", "--json"]);
	const raw = result.stdout.trim();

	let parsed = null;
	try {
		parsed = raw ? JSON.parse(raw) : null;
	} catch {
		parsed = null;
	}

	if (!parsed?.metadata?.vulnerabilities) {
		log("Could not parse npm audit JSON output.");
		if (result.stderr.trim()) {
			log(result.stderr.trim());
		}
		return {
			hasBlocking: true,
			parseError: true,
			vulnerabilities: null,
		};
	}

	const vulnerabilities = parsed.metadata.vulnerabilities;
	const critical = vulnerabilities.critical ?? 0;
	const high = vulnerabilities.high ?? 0;
	const moderate = vulnerabilities.moderate ?? 0;
	const low = vulnerabilities.low ?? 0;

	log(
		`Vulnerabilities => critical:${critical} high:${high} moderate:${moderate} low:${low}`
	);

	if (isStrictMode) {
		return {
			hasBlocking: critical > 0 || high > 0 || moderate > 0,
			parseError: false,
			vulnerabilities: { critical, high, moderate, low },
		};
	}
	return {
		hasBlocking: critical > 0,
		parseError: false,
		vulnerabilities: { critical, high, moderate, low },
	};
};

const runSecretScan = () => {
	log("== Secret scan ==");
	const pattern = `(${SECRET_PATTERNS.join("|")})`;
	const args = [
		"--hidden",
		"--line-number",
		"--with-filename",
		"--glob",
		"!**/node_modules/**",
		"--glob",
		"!**/dist/**",
		"--glob",
		"!**/.git/**",
		"--glob",
		"!**/.cursor/**",
		"--glob",
		"!**/test-results/**",
		pattern,
		".",
	];
	const result = run("rg", args);
	if (result.status === 1) {
		log("No secret-like matches found.");
		return { hasBlocking: false, scanError: false, matches: [] };
	}

	if (result.status === 0) {
		const matches = result.stdout
			.trim()
			.split("\n")
			.filter(Boolean);
		log("Potential secret matches found:");
		log(result.stdout.trim());
		return { hasBlocking: true, scanError: false, matches };
	}

	log("Secret scan failed to run.");
	if (result.stderr.trim()) {
		log(result.stderr.trim());
	}
	return { hasBlocking: true, scanError: true, matches: [] };
};

const main = () => {
	log(`Mode: ${isStrictMode ? "strict" : "default"}`);
	const audit = runAudit();
	const secretScan = runSecretScan();

	const hasBlocking = audit.hasBlocking || secretScan.hasBlocking;
	const report = {
		mode: isStrictMode ? "strict" : "default",
		passed: !hasBlocking,
		audit: {
			parseError: audit.parseError,
			vulnerabilities: audit.vulnerabilities,
		},
		secretScan: {
			scanError: secretScan.scanError,
			matchCount: secretScan.matches.length,
			matches: secretScan.matches,
		},
	};

	if (outputPath) {
		writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
	}

	if (emitJson) {
		console.log(JSON.stringify(report, null, 2));
	}

	if (hasBlocking) {
		log("\nSecurity checks failed.");
		process.exit(1);
	}
	log("\nSecurity checks passed.");
};

main();
