import type { ReactElement } from "react";
import type { ExtensionSettings } from "@/shared/contracts";
import { openSettingsPage } from "@/openSettingsPage";
import { THRESHOLD_MAX, THRESHOLD_MIN } from "./constants";
import { clampThreshold } from "./utils";

export const SubmissionFlowSection = ({
	settings,
	thresholdDraft,
	status,
	onThresholdChange,
}: {
	settings: ExtensionSettings;
	thresholdDraft: number;
	status: "idle" | "saving" | "error";
	onThresholdChange: (value: number) => void;
}): ReactElement => (
	<section className="card card-sync">
		<h2 className="card-heading">Submission flow</h2>
		{settings.selectedRepoFullName ? (
			<a
				className="sync-target"
				href={`https://github.com/${settings.selectedRepoFullName}/tree/${settings.selectedBranch ?? "main"}`}
				target="_blank"
				rel="noreferrer"
			>
				<span className="sync-target-label">Syncing to</span>
				<span className="sync-target-repo">{settings.selectedRepoFullName}</span>
				<span className="sync-target-branch">
					· {settings.selectedBranch ?? "main"}
				</span>
			</a>
		) : (
			<p className="sync-target sync-target-empty">
				<span className="sync-target-label">No repo selected.</span>
				<button type="button" className="btn-link" onClick={openSettingsPage}>
					Set up in Settings
				</button>
			</p>
		)}
		{settings.selectedRepoFullName ? (
			<>
				<div className="threshold-head">
					<label className="field-label" htmlFor="thr">
						Match threshold
					</label>
					<span className="threshold-value">{thresholdDraft}%</span>
				</div>
				<div className="threshold-controls">
					<button
						type="button"
						className="threshold-step"
						aria-label="Decrease threshold by 1"
						disabled={status === "saving" || thresholdDraft <= THRESHOLD_MIN}
						onClick={() =>
							onThresholdChange(clampThreshold(thresholdDraft - 1))
						}
					>
						−
					</button>
					<input
						id="thr"
						className="field-slider"
						type="range"
						min={THRESHOLD_MIN}
						max={THRESHOLD_MAX}
						value={thresholdDraft}
						disabled={status === "saving"}
						onChange={(e) => {
							const t = Number(e.target.value);
							if (Number.isFinite(t)) {
								onThresholdChange(clampThreshold(t));
							}
						}}
					/>
					<button
						type="button"
						className="threshold-step"
						aria-label="Increase threshold by 1"
						disabled={status === "saving" || thresholdDraft >= THRESHOLD_MAX}
						onClick={() =>
							onThresholdChange(clampThreshold(thresholdDraft + 1))
						}
					>
						+
					</button>
				</div>
				<p className="threshold-status">
					{thresholdDraft !== settings.threshold || status === "saving"
						? "Saving…"
						: "Saved"}
				</p>
			</>
		) : null}
	</section>
);
