import type { ExtensionSettings, SubmissionPayload } from "@/shared/contracts";
import { fetchRemoteImageAsDataUrl } from "@/remoteImageFetch";
import { resolveCssBattleImageUrl } from "./cssBattleAssets";
import {
	getSavedSubmissionMetrics,
	type CommitFile,
	type SavedSubmissionMetrics,
} from "@/githubClient";
import {
	challengeFolderPath,
	formatChallengeTitle,
	listBestSubmissionMetadataPaths,
} from "./challengeModel";
import { resolveSubmissionCharacterCount } from "./characterCount";
import {
	battleManifestPathFromGroup,
	buildBattleManifestFromPayload,
} from "./battleManifest";
import { formatSubmissionCode } from "./codeFormatting";

export {
	challengeFolderPath,
	formatChallengeTitle,
	listBestSubmissionMetadataPaths,
} from "./challengeModel";

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

const buildCodeSection = (heading: string, code: string): string => {
	const fence = getMarkdownFence(code);
	return `## ${heading}

${fence}html
${code}
${fence}
`;
};

const buildReadme = (
	payload: SubmissionPayload,
	hasUserImage: boolean,
	hasTargetImage: boolean,
	formattedCode: { primary: string; prettifiedExtra?: string }
): string => {
	const title = formatChallengeTitle(payload);
	const challengeUrl = getChallengeUrl(payload);
	const userCell = hasUserImage
		? `<img src="./user.png" alt="User Submission" width="100%">`
		: "Not available";
	const targetCell = hasTargetImage
		? `<img src="./target.png" alt="Target" width="100%">`
		: "Not available";
	const primaryCode = formattedCode.primary || "<!-- empty submission -->";
	const prettifiedSection =
		formattedCode.prettifiedExtra !== undefined
			? `\n${buildCodeSection("Prettified code", formattedCode.prettifiedExtra)}`
			: "";

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

${buildCodeSection("Code", primaryCode)}${prettifiedSection}`;
};

export const buildSubmissionFiles = async (
	payload: SubmissionPayload,
	settings: Pick<ExtensionSettings, "savedCodeFormat" | "includePrettifiedCode">
): Promise<CommitFile[]> => {
	const folder = challengeFolderPath(payload);
	const files: CommitFile[] = [];
	const formattedCode = await formatSubmissionCode(payload.code, settings);

	files.push(
		{ path: `${folder}/solution.html`, delete: true },
		{ path: `${folder}/result.png`, delete: true },
		{ path: `${folder}/target.url.txt`, delete: true }
	);

	const characterCount = resolveSubmissionCharacterCount(payload);
	const metadata = {
		challengeMode: payload.challengeMode,
		challengeId: payload.challengeId,
		challengeName: payload.challengeName,
		challengeUrl: getChallengeUrl(payload),
		battleId: payload.battleId ?? null,
		battleGroup: payload.battleGroup ?? null,
		challengeLabel: payload.challengeLabel ?? null,
		battleTotalChallenges: payload.battleTotalChallenges ?? null,
		battleStatus: payload.battleStatus ?? null,
		dailyDateIso: payload.dailyDateIso ?? null,
		dailyDateLabel: payload.dailyDateLabel ?? null,
		submittedAt: payload.submittedAt,
		score: payload.score,
		matchPct: payload.matchPct,
		characterCount,
	};
	files.push({
		path: `${folder}/submission.json`,
		content: JSON.stringify(metadata, null, 2),
		encoding: "utf-8",
	});

	const battleManifest = buildBattleManifestFromPayload(payload);
	if (battleManifest) {
		files.push({
			path: battleManifestPathFromGroup(battleManifest.battleGroup),
			content: JSON.stringify(battleManifest, null, 2),
			encoding: "utf-8",
		});
	}

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
		content: buildReadme(
			payload,
			Boolean(payload.resultImageDataUrl),
			hasTargetImage,
			formattedCode
		),
		encoding: "utf-8",
	});

	return files;
};

export const formatCommitMessage = (
	score: number | null,
	characterCount: number,
	matchPct: number | null
): string => {
	const scoreValue = score ?? 0;
	const matchValue = (matchPct ?? 0).toFixed(2);
	return `Score: ${scoreValue}, Characters: ${characterCount} (${matchValue}% match) - CSSHub`;
};
