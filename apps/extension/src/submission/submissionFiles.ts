import type { SubmissionPayload } from "../shared/contracts";
import { fetchRemoteImageAsDataUrl } from "../remoteImageFetch";
import { resolveCssBattleImageUrl } from "./cssBattleAssets";
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
	if (payload.challengeMode === "daily" && payload.dailyDateIso) {
		return payload.dailyDateIso;
	}

	if (payload.challengeMode === "battle" && payload.battleGroup && payload.challengeLabel) {
		return `${payload.battleGroup}/${payload.challengeLabel}`;
	}

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

export const challengeFolderPath = (payload: SubmissionPayload): string => {
	if (payload.challengeMode === "daily" && payload.dailyDateIso) {
		return `Daily Targets/${payload.dailyDateIso}`;
	}
	if (payload.challengeMode === "battle" && payload.battleGroup && payload.challengeLabel) {
		return `Battles/${payload.battleGroup}/${payload.challengeLabel}`;
	}
	return `challenges/${challengeStorageKey(payload)}`;
};

const submissionMetadataPath = (folder: string): string => `${folder}/submission.json`;

const legacyNumericSubmissionPath = (payload: SubmissionPayload): string | null => {
	const rawId = payload.challengeId.trim();
	if (/^\d+$/.test(rawId)) {
		return submissionMetadataPath(`challenges/${rawId}`);
	}
	return null;
};

const legacySlugSubmissionPath = (payload: SubmissionPayload): string => {
	const legacySlug = slugify(`${payload.challengeId}-${payload.challengeName}`);
	return submissionMetadataPath(`challenges/${legacySlug}`);
};

export const listBestSubmissionMetadataPaths = (payload: SubmissionPayload): string[] => {
	const paths = [submissionMetadataPath(challengeFolderPath(payload))];
	const legacyNumeric = legacyNumericSubmissionPath(payload);
	if (legacyNumeric) {
		paths.push(legacyNumeric);
	}
	paths.push(legacySlugSubmissionPath(payload));
	return paths;
};

export const readBestSubmissionMetrics = async (
	token: string,
	repoFullName: string,
	branch: string,
	payload: SubmissionPayload
): Promise<SavedSubmissionMetrics | null> => {
	for (const path of listBestSubmissionMetadataPaths(payload)) {
		const metrics = await getSavedSubmissionMetrics(token, repoFullName, branch, path);
		if (metrics) {
			return metrics;
		}
	}
	return null;
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

const getMarkdownFence = (content: string): string => {
	let fence = "```";
	while (content.includes(fence)) {
		fence += "`";
	}
	return fence;
};

export const formatChallengeTitle = (payload: SubmissionPayload): string => {
	if (payload.challengeMode === "daily" && payload.dailyDateLabel) {
		return `Daily Target — ${payload.dailyDateLabel}`;
	}
	if (payload.challengeMode === "battle" && payload.challengeLabel) {
		return payload.challengeLabel;
	}
	if (payload.challengeId === "unknown") {
		return payload.challengeName;
	}
	return `Target ${payload.challengeId}: ${payload.challengeName}`;
};

const getChallengeUrl = (payload: SubmissionPayload): string =>
	payload.challengeUrl ??
	`https://cssbattle.dev/play/${encodeURIComponent(payload.challengeId)}`;

const fetchImageAsBase64 = async (
	url: string,
	challengeUrl?: string | null
): Promise<string | null> => {
	const resolved = resolveCssBattleImageUrl(url, challengeUrl);
	const dataUrl = await fetchRemoteImageAsDataUrl(resolved);
	if (!dataUrl) {
		return null;
	}
	const commaIndex = dataUrl.indexOf(",");
	if (commaIndex < 0) {
		return null;
	}
	return dataUrl.slice(commaIndex + 1);
};

const buildReadme = (
	payload: SubmissionPayload,
	hasUserImage: boolean,
	hasTargetImage: boolean
): string => {
	const title = formatChallengeTitle(payload);
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
		challengeMode: payload.challengeMode,
		challengeId: payload.challengeId,
		challengeName: payload.challengeName,
		challengeUrl: getChallengeUrl(payload),
		battleGroup: payload.battleGroup ?? null,
		challengeLabel: payload.challengeLabel ?? null,
		dailyDateIso: payload.dailyDateIso ?? null,
		dailyDateLabel: payload.dailyDateLabel ?? null,
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
		const targetImageBase64 = await fetchImageAsBase64(
			payload.targetImage.value,
			payload.challengeUrl
		);
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
