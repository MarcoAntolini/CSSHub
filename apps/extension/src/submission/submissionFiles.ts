import type { SubmissionPayload } from "../shared/contracts";
import {
	getSavedSubmissionMetrics,
	type CommitFile,
	type SavedSubmissionMetrics,
} from "../githubClient";

const slugify = (value: string): string =>
	value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

export const challengeStorageKey = (payload: SubmissionPayload): string => {
	const rawId = payload.challengeId.trim().toLowerCase();
	if (/^\d+$/.test(rawId)) {
		return rawId;
	}
	if (rawId && rawId !== "unknown") {
		const normalized = rawId
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "");
		if (normalized) {
			return normalized;
		}
	}
	const fallback = slugify(payload.challengeName);
	return fallback ? `unknown-${fallback}` : "unknown";
};

export const challengeFolderPath = (payload: SubmissionPayload): string =>
	`challenges/${challengeStorageKey(payload)}`;

const submissionMetadataPath = (payload: SubmissionPayload): string =>
	`${challengeFolderPath(payload)}/submission.json`;

const legacySubmissionMetadataPath = (payload: SubmissionPayload): string => {
	const legacySlug = slugify(`${payload.challengeId}-${payload.challengeName}`);
	return `challenges/${legacySlug}/submission.json`;
};

export const readBestSubmissionMetrics = async (
	token: string,
	repoFullName: string,
	branch: string,
	payload: SubmissionPayload
): Promise<SavedSubmissionMetrics | null> => {
	const primary = await getSavedSubmissionMetrics(
		token,
		repoFullName,
		branch,
		submissionMetadataPath(payload)
	);
	if (primary) {
		return primary;
	}
	return getSavedSubmissionMetrics(
		token,
		repoFullName,
		branch,
		legacySubmissionMetadataPath(payload)
	);
};

const toBase64 = (bytes: Uint8Array): string => {
	let output = "";
	for (const value of bytes) {
		output += String.fromCharCode(value);
	}
	return btoa(output);
};

const getBase64FromDataUrl = (dataUrl: string): string => {
	const base64 = dataUrl.split(",")[1];
	if (!base64) {
		throw new Error("Invalid data URL");
	}
	return base64;
};

const escapeHtml = (value: string): string =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const getMarkdownFence = (content: string): string => {
	let fence = "```";
	while (content.includes(fence)) {
		fence += "`";
	}
	return fence;
};

export const formatChallengeTitle = (payload: SubmissionPayload): string => {
	if (payload.challengeId === "unknown") {
		return payload.challengeName;
	}
	return `Target ${payload.challengeId}: ${payload.challengeName}`;
};

const getChallengeUrl = (payload: SubmissionPayload): string =>
	payload.challengeUrl ??
	`https://cssbattle.dev/play/${encodeURIComponent(payload.challengeId)}`;

const formatSubmissionMetric = (value: number | null, suffix = ""): string =>
	value === null ? "Not available" : `${value}${suffix}`;

const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			return null;
		}

		const bytes = new Uint8Array(await response.arrayBuffer());
		return toBase64(bytes);
	} catch (_error) {
		return null;
	}
};

const buildReadme = (
	payload: SubmissionPayload,
	hasUserImage: boolean,
	hasTargetImage: boolean
): string => {
	const title = formatChallengeTitle(payload);
	const escapedTitle = escapeHtml(title);
	const challengeUrl = getChallengeUrl(payload);
	const userCell = hasUserImage
		? `<img src="./user.png" alt="User Submission" width="100%">`
		: "Not available";
	const targetCell = hasTargetImage
		? `<img src="./target.png" alt="Target" width="100%">`
		: "Not available";
	const code = payload.code || "<!-- empty submission -->";
	const fence = getMarkdownFence(code);

	return `# ${title}

Challenge: <${challengeUrl}>

## Result

<table>
	<tr>
		<th width="50%">User Submission</th>
		<th width="50%">Target</th>
	</tr>
	<tr>
		<td width="50%" align="center">
			${userCell}
		</td>
		<td width="50%" align="center">
			${targetCell}
		</td>
	</tr>
</table>

## Code

${fence}html
${code}
${fence}

## Submission Data

- Challenge: ${escapedTitle}
- Score: ${formatSubmissionMetric(payload.score)}
- Match: ${formatSubmissionMetric(payload.matchPct, "%")}
- Submitted at: ${payload.submittedAt}
`;
};

export const buildSubmissionFiles = async (
	payload: SubmissionPayload
): Promise<CommitFile[]> => {
	const folder = challengeFolderPath(payload);
	const files: CommitFile[] = [];

	files.push(
		{ path: `${folder}/solution.html`, delete: true },
		{ path: `${folder}/result.png`, delete: true },
		{ path: `${folder}/target.url.txt`, delete: true }
	);

	const metadata = {
		challengeId: payload.challengeId,
		challengeName: payload.challengeName,
		challengeUrl: getChallengeUrl(payload),
		submittedAt: payload.submittedAt,
		score: payload.score,
		matchPct: payload.matchPct,
	};
	files.push({
		path: `${folder}/submission.json`,
		content: JSON.stringify(metadata, null, 2),
		encoding: "utf-8",
	});

	if (payload.resultImageDataUrl) {
		files.push({
			path: `${folder}/user.png`,
			content: getBase64FromDataUrl(payload.resultImageDataUrl),
			encoding: "base64",
		});
	}

	let hasTargetImage = false;
	if (payload.targetImage?.type === "dataUrl") {
		files.push({
			path: `${folder}/target.png`,
			content: getBase64FromDataUrl(payload.targetImage.value),
			encoding: "base64",
		});
		hasTargetImage = true;
	}

	if (payload.targetImage?.type === "url") {
		const targetImageBase64 = await fetchImageAsBase64(payload.targetImage.value);
		if (targetImageBase64) {
			files.push({
				path: `${folder}/target.png`,
				content: targetImageBase64,
				encoding: "base64",
			});
			hasTargetImage = true;
		}
	}

	files.unshift({
		path: `${folder}/README.md`,
		content: buildReadme(payload, Boolean(payload.resultImageDataUrl), hasTargetImage),
		encoding: "utf-8",
	});

	return files;
};

export const formatCommitMessage = (
	score: number | null,
	matchPct: number | null
): string => {
	const scoreValue = score ?? 0;
	const matchValue = (matchPct ?? 0).toFixed(2);
	return `Score: ${scoreValue} (${matchValue}% match) - CSSHub`;
};
