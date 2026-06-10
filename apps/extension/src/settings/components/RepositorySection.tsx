import type { ReactElement } from "react";
import type { Branch, ExtensionSettings, Repo } from "@/shared/contracts";

type RepositorySectionProps = {
	settings: ExtensionSettings;
	selectedRepoMeta: Repo | null;
	branches: Branch[];
	branchesLoading: boolean;
	createBranchName: string;
	createBranchFrom: string;
	readmeInfoOpen: boolean;
	busy: boolean;
	onCreateBranchNameChange: (value: string) => void;
	onCreateBranchFromChange: (value: string) => void;
	onReadmeInfoOpenChange: (open: boolean) => void;
	onOpenPickModal: () => void;
	onClearRepoSelection: () => void;
	onOpenCreateModal: () => void;
	onSaveSettings: (next: ExtensionSettings) => void;
	onConfirmCreateBranch: () => void;
};

export const RepositorySection = ({
	settings,
	selectedRepoMeta,
	branches,
	branchesLoading,
	createBranchName,
	createBranchFrom,
	readmeInfoOpen,
	busy,
	onCreateBranchNameChange,
	onCreateBranchFromChange,
	onReadmeInfoOpenChange,
	onOpenPickModal,
	onClearRepoSelection,
	onOpenCreateModal,
	onSaveSettings,
	onConfirmCreateBranch,
}: RepositorySectionProps): ReactElement => {
	const selectedBranch =
		settings.selectedBranch ?? selectedRepoMeta?.defaultBranch ?? "main";
	const repoUrl = settings.selectedRepoFullName
		? `https://github.com/${settings.selectedRepoFullName}`
		: null;
	const branchPath = selectedBranch
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
	const branchUrl = repoUrl ? `${repoUrl}/tree/${branchPath}` : null;

	return (
		<section className="settings-section">
			<h2>Repository</h2>
			{settings.selectedRepoFullName ? (
				<>
					<div className="repo-panel">
						<div className="repo-panel-meta">
							<p className="repo-fullname">
								{repoUrl ? (
									<a
										className="repo-link repo-fullname-link"
										href={repoUrl}
										target="_blank"
										rel="noreferrer noopener"
									>
										{settings.selectedRepoFullName}
									</a>
								) : (
									settings.selectedRepoFullName
								)}
							</p>
							<p className="repo-branch-line">
								Branch:{" "}
								{branchUrl ? (
									<a
										className="repo-link repo-branch-name"
										href={branchUrl}
										target="_blank"
										rel="noreferrer noopener"
									>
										{selectedBranch}
									</a>
								) : (
									<strong className="repo-branch-name">{selectedBranch}</strong>
								)}
							</p>
						</div>
						<div
							className="repo-panel-toolbar"
							role="group"
							aria-label="Repository actions"
						>
							<div className="repo-toolbar-start">
								<button
									type="button"
									className="btn btn-ghost repo-panel-btn"
									onClick={onOpenPickModal}
									disabled={busy}
								>
									Change repository…
								</button>
								<button
									type="button"
									className="btn btn-ghost repo-panel-btn"
									onClick={onClearRepoSelection}
									disabled={busy}
								>
									Clear selection
								</button>
							</div>
							<button
								type="button"
								className="btn btn-primary repo-panel-btn repo-toolbar-primary"
								onClick={onOpenCreateModal}
								disabled={busy}
							>
								Create new…
							</button>
						</div>
					</div>
					{branchesLoading ? (
						<p className="repo-branches-hint muted">Loading branches…</p>
					) : null}
					<div className="branch-workspace">
						<p className="branch-workspace-title">Branch</p>
						<div className="branch-sync-panel">
							<div className="row">
								<label htmlFor="branch-settings">Sync branch</label>
								<select
									id="branch-settings"
									value={settings.selectedBranch ?? ""}
									disabled={busy || branchesLoading || branches.length === 0}
									onChange={(e) => {
										const nextBranch = e.target.value || null;
										onSaveSettings({
											...settings,
											selectedBranch: nextBranch,
										});
									}}
								>
									{branches.length === 0 ? (
										<option value="">No branches found</option>
									) : (
										branches.map((branch) => (
											<option key={branch.name} value={branch.name}>
												{branch.name}
											</option>
										))
									)}
								</select>
							</div>
						</div>
						<div className="branch-create-panel">
							<div className="branch-create-grid">
								<div className="row">
									<label htmlFor="branch-create-name">Create new branch</label>
									<input
										id="branch-create-name"
										type="text"
										placeholder="feature/my-branch"
										value={createBranchName}
										onChange={(e) => onCreateBranchNameChange(e.target.value)}
										disabled={busy || branchesLoading}
									/>
								</div>
								<div className="row">
									<label htmlFor="branch-create-from">From branch</label>
									<select
										id="branch-create-from"
										value={createBranchFrom}
										onChange={(e) => onCreateBranchFromChange(e.target.value)}
										disabled={busy || branchesLoading || branches.length === 0}
									>
										{branches.length === 0 ? (
											<option value="">No source branch</option>
										) : (
											branches.map((branch) => (
												<option key={`from-${branch.name}`} value={branch.name}>
													{branch.name}
												</option>
											))
										)}
									</select>
								</div>
							</div>
						</div>
						<div className="branch-workspace-foot">
							<button
								type="button"
								className="btn btn-primary branch-create-submit"
								onClick={onConfirmCreateBranch}
								disabled={busy || branchesLoading || branches.length === 0}
							>
								Create branch
							</button>
						</div>
					</div>
					<div className="repo-readme-card">
						<div className="repo-readme-card-head">
							<h3 className="repo-readme-card-title">Root README</h3>
						<button
							type="button"
							className="help-badge"
							aria-expanded={readmeInfoOpen}
							aria-controls="readme-mode-info-panel"
							onClick={() => onReadmeInfoOpenChange(!readmeInfoOpen)}
							title="How README modes work"
						>
							?
						</button>
					</div>
					{readmeInfoOpen ? (
						<div
							className="readme-info-panel"
							id="readme-mode-info-panel"
							role="region"
							aria-label="Root README mode details"
						>
							<p>
								<strong>Managed section</strong> (default) updates only the region
								between these markers in the repository root{" "}
								<code className="readme-info-code">README.md</code>:
							</p>
							<pre className="readme-info-markers">{`<!-- CSSHUB:README-START -->
(list of challenge links)
<!-- CSSHUB:README-END -->`}</pre>
							<p>
								Text above or below that block is never touched. Each sync refreshes
								the index in the same commit as your solution. The index lists{" "}
								<strong>Battles</strong> and <strong>Daily Targets</strong> in
								collapsible sections; other CSSBattle modes are not synced.
							</p>
							<p>
								<strong>Full</strong> replaces the entire root README on every sync.
							</p>
							<p>
								<strong>Off</strong> leaves root README.md unchanged (challenge
								folders still get their own READMEs).
							</p>
						</div>
					) : null}
					<div className="row row-tight">
						<label htmlFor="readme-mode-settings">Mode</label>
						<select
							id="readme-mode-settings"
							value={settings.repositoryReadmeMode ?? "managed-section"}
							disabled={busy || branchesLoading}
							onChange={(e) => {
								const v = e.target.value;
								if (
									v === "off" ||
									v === "managed-section" ||
									v === "full"
								) {
									onSaveSettings({
										...settings,
										repositoryReadmeMode: v,
									});
								}
							}}
						>
							<option value="off">Off — never change root README.md</option>
							<option value="managed-section">
								Managed section (recommended)
							</option>
							<option value="full">Full — replace entire README.md</option>
						</select>
					</div>
				</div>
			</>
		) : (
			<>
				<p className="muted">No repository selected for sync.</p>
				<div className="btn-stack">
					<button
						type="button"
						className="btn btn-primary"
						onClick={onOpenCreateModal}
						disabled={busy}
					>
						Create repository…
					</button>
					<button
						type="button"
						className="btn"
						onClick={onOpenPickModal}
						disabled={busy}
					>
						Choose existing…
					</button>
				</div>
			</>
		)}
		</section>
	);
};
