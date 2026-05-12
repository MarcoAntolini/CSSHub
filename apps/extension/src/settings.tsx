import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	deviceFlowStartResponseSchema,
	extensionStateResponseSchema,
	popupToBackgroundMessageSchema,
	branchSchema,
	repoSchema,
	type Branch,
	type ExtensionSettings,
	type Repo,
	type AuthStatus,
	type SubmissionPayload,
	type SubmissionIngestionResponse,
	type SyncEvent,
} from "./shared/contracts";
import "../public/settings.css";

type LoadedState = {
	auth: AuthStatus;
	settings: ExtensionSettings;
	repos: Repo[];
	lastSubmission: SubmissionPayload | null;
	lastSubmissionAccepted: boolean | null;
	lastIngestion: SubmissionIngestionResponse | null;
	recentEvents: SyncEvent[];
};

const oauthRedirectHint = (): string => chrome.identity.getRedirectURL("github");
type UiNotice = {
	level: "success" | "warn" | "error";
	message: string;
};
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;

const validateBranchName = (
	value: string,
	existingBranchNames: Set<string>
): string | null => {
	if (!value) {
		return "Branch name required";
	}
	if (!BRANCH_NAME_PATTERN.test(value)) {
		return "Use only letters, numbers, dot, underscore, slash, and dash";
	}
	if (
		value.includes("..") ||
		value.includes("//") ||
		value.startsWith("/") ||
		value.endsWith("/") ||
		value.startsWith(".") ||
		value.endsWith(".") ||
		value.endsWith(".lock")
	) {
		return "Invalid branch format";
	}
	if (existingBranchNames.has(value)) {
		return "Branch already exists";
	}
	return null;
};

const App = (): ReactElement => {
	const [data, setData] = useState<LoadedState | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<UiNotice | null>(null);

	const [patToken, setPatToken] = useState("");
	const [deviceFlow, setDeviceFlow] = useState<{
		deviceCode: string;
		userCode: string;
		verificationUri: string;
		verificationUriComplete: string | null;
		interval: number;
	} | null>(null);

	const [createOpen, setCreateOpen] = useState(false);
	const [createName, setCreateName] = useState("");
	const [createPrivate, setCreatePrivate] = useState(true);

	const [pickOpen, setPickOpen] = useState(false);
	const [pickSearch, setPickSearch] = useState("");
	const [pickList, setPickList] = useState<Repo[]>([]);
	const [pickSelected, setPickSelected] = useState<Repo | null>(null);
	const [branches, setBranches] = useState<Branch[]>([]);
	const [branchesLoading, setBranchesLoading] = useState(false);
	const [createBranchName, setCreateBranchName] = useState("");
	const [createBranchFrom, setCreateBranchFrom] = useState("");

	const loadState = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "getExtensionState",
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setError(response?.error ?? "Failed to load settings");
			setLoading(false);
			return;
		}
		const parsed = extensionStateResponseSchema.safeParse(response.data);
		if (!parsed.success) {
			setError("Invalid server response");
			setLoading(false);
			return;
		}
		setData({
			auth: parsed.data.auth,
			settings: parsed.data.settings,
			repos: parsed.data.repos,
			lastSubmission: parsed.data.lastSubmission,
			lastSubmissionAccepted: parsed.data.lastSubmissionAccepted,
			lastIngestion: parsed.data.lastIngestion,
			recentEvents: parsed.data.recentEvents,
		});
		setLoading(false);
	}, []);

	useEffect(() => {
		void loadState();
	}, [loadState]);

	useEffect(() => {
		if (!data?.auth.isAuthenticated || !data.settings.selectedRepoFullName) {
			setBranches([]);
			setCreateBranchFrom("");
			return;
		}

		let cancelled = false;
		const repoFullName = data.settings.selectedRepoFullName;
		const selectedBranch = data.settings.selectedBranch;
		const defaultBranch =
			data.repos.find((repo) => repo.fullName === repoFullName)?.defaultBranch ??
			null;

		setBranchesLoading(true);
		void refreshBranchesOnly(repoFullName)
			.then((fetched) => {
				if (cancelled) {
					return;
				}
				setBranches(fetched);
				const fallbackBranch = defaultBranch ?? fetched[0]?.name ?? null;
				const validSelection =
					selectedBranch && fetched.some((branch) => branch.name === selectedBranch)
						? selectedBranch
						: fallbackBranch;
				if (validSelection) {
					setCreateBranchFrom((prev) =>
						prev && fetched.some((branch) => branch.name === prev)
							? prev
							: validSelection
					);
				} else {
					setCreateBranchFrom("");
				}

				if (selectedBranch && validSelection && selectedBranch !== validSelection) {
					void saveSettingsRemote({
						...data.settings,
						selectedBranch: validSelection,
					});
				}
			})
			.finally(() => {
				if (!cancelled) {
					setBranchesLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [data]);

	const saveSettingsRemote = async (
		next: ExtensionSettings
	): Promise<boolean> => {
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "saveSettings",
			settings: next,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Could not save settings");
			setNotice({
				level: "error",
				message: "Could not save settings",
			});
			return false;
		}
		setData((prev) => (prev ? { ...prev, settings: next } : prev));
		setNotice({
			level: "success",
			message: "Settings updated",
		});
		return true;
	};

	const refreshReposOnly = async (): Promise<Repo[]> => {
		const message = popupToBackgroundMessageSchema.parse({
			action: "listRepos",
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setError(response?.error ?? "Could not list repositories");
			return [];
		}
		const parsed = repoSchema.array().safeParse(response.data);
		return parsed.success ? parsed.data : [];
	};

	const refreshBranchesOnly = async (repoFullName: string): Promise<Branch[]> => {
		const message = popupToBackgroundMessageSchema.parse({
			action: "listBranches",
			repoFullName,
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setError(response?.error ?? "Could not list branches");
			return [];
		}
		const parsed = branchSchema.array().safeParse(response.data);
		return parsed.success ? parsed.data : [];
	};

	const beginWebFlow = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "startGithubWebFlow",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Web OAuth failed");
			setNotice({
				level: "error",
				message: "Web OAuth failed",
			});
			return;
		}
		setNotice({
			level: "success",
			message: "GitHub account connected",
		});
		await loadState();
	};

	const beginDeviceFlow = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "startGithubDeviceFlow",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Device flow failed");
			setNotice({
				level: "error",
				message: "Device flow failed",
			});
			return;
		}
		const payload = deviceFlowStartResponseSchema.safeParse(response.data);
		if (!payload.success) {
			setError("Invalid device flow response");
			return;
		}
		setDeviceFlow({
			deviceCode: payload.data.deviceCode,
			userCode: payload.data.userCode,
			verificationUri: payload.data.verificationUri,
			verificationUriComplete: payload.data.verificationUriComplete,
			interval: payload.data.interval,
		});
		await chrome.tabs.create({
			url: payload.data.verificationUriComplete ?? payload.data.verificationUri,
		});
	};

	const pollDevice = async (): Promise<void> => {
		if (!deviceFlow) {
			return;
		}
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "pollGithubDeviceFlow",
			deviceCode: deviceFlow.deviceCode,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Polling failed");
			setNotice({
				level: "error",
				message: "Polling failed",
			});
			return;
		}
		if (response.data?.status === "pending") {
			setError("Still waiting — approve on GitHub first.");
			setNotice({
				level: "warn",
				message: "Waiting for GitHub approval",
			});
			return;
		}
		if (response.data?.status === "authenticated") {
			setDeviceFlow(null);
			setNotice({
				level: "success",
				message: "GitHub account connected",
			});
			await loadState();
		}
	};

	const loginPat = async (): Promise<void> => {
		if (!patToken.trim()) {
			setError("Paste a token");
			return;
		}
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "loginWithPat",
			token: patToken.trim(),
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "PAT login failed");
			setNotice({
				level: "error",
				message: "PAT login failed",
			});
			return;
		}
		setPatToken("");
		setNotice({
			level: "success",
			message: "GitHub account connected",
		});
		await loadState();
	};

	const logout = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "logoutGithub",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Logout failed");
			setNotice({
				level: "error",
				message: "Logout failed",
			});
			return;
		}
		setDeviceFlow(null);
		setNotice({
			level: "warn",
			message: "GitHub account disconnected",
		});
		await loadState();
	};

	const clearActivityLog = async (): Promise<void> => {
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "clearRecentEvents",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Could not clear activity log");
			setNotice({
				level: "error",
				message: "Could not clear activity log",
			});
			return;
		}
		setData((prev) => (prev ? { ...prev, recentEvents: [] } : prev));
		setNotice({
			level: "success",
			message: "Activity log cleared",
		});
	};

	const clearRepoSelection = async (): Promise<void> => {
		if (!data) {
			return;
		}
		const ok = await saveSettingsRemote({
			...data.settings,
			selectedRepoFullName: null,
			selectedBranch: null,
		});
		if (ok) {
			setBranches([]);
			setCreateBranchFrom("");
			setCreateBranchName("");
			await loadState();
		}
	};

	const openPickModal = async (): Promise<void> => {
		setPickOpen(true);
		setPickSearch("");
		setPickSelected(null);
		setBusy(true);
		const repos = await refreshReposOnly();
		setPickList(repos);
		setBusy(false);
	};

	const confirmPickRepo = async (): Promise<void> => {
		if (!data || !pickSelected) {
			return;
		}
		const ok = await saveSettingsRemote({
			...data.settings,
			selectedRepoFullName: pickSelected.fullName,
			selectedBranch: pickSelected.defaultBranch,
		});
		if (ok) {
			setPickOpen(false);
			await loadState();
		}
	};

	const confirmCreateRepo = async (): Promise<void> => {
		if (!createName.trim()) {
			setError("Repository name required");
			return;
		}
		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "createRepo",
			name: createName.trim(),
			private: createPrivate,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Create failed");
			setNotice({
				level: "error",
				message: "Repository creation failed",
			});
			return;
		}
		setCreateOpen(false);
		setCreateName("");
		setNotice({
			level: "success",
			message: "Repository created and selected",
		});
		await loadState();
	};

	const confirmCreateBranch = async (): Promise<void> => {
		if (!data?.settings.selectedRepoFullName) {
			setError("Select a repository first");
			return;
		}

		const newBranchName = createBranchName.trim();
		const existing = new Set(branches.map((branch) => branch.name));
		const validationError = validateBranchName(newBranchName, existing);
		if (validationError) {
			setError(validationError);
			setNotice({
				level: "warn",
				message: validationError,
			});
			return;
		}

		const fromBranch =
			createBranchFrom ||
			data.settings.selectedBranch ||
			selectedRepoMeta?.defaultBranch ||
			branches[0]?.name ||
			"";
		if (!fromBranch) {
			setError("No source branch available");
			setNotice({
				level: "warn",
				message: "No source branch available",
			});
			return;
		}

		setBusy(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "createBranch",
			repoFullName: data.settings.selectedRepoFullName,
			newBranch: newBranchName,
			fromBranch,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			setError(response?.error ?? "Could not create branch");
			setNotice({
				level: "error",
				message: "Branch creation failed",
			});
			return;
		}

		const nextSelection = {
			...data.settings,
			selectedBranch: newBranchName,
		};
		setCreateBranchName("");
		setCreateBranchFrom(newBranchName);
		setData((prev) => (prev ? { ...prev, settings: nextSelection } : prev));
		setNotice({
			level: "success",
			message: `Branch ${newBranchName} created`,
		});
		const fetched = await refreshBranchesOnly(data.settings.selectedRepoFullName);
		setBranches(fetched);
	};

	const filteredPickList = useMemo(() => {
		const q = pickSearch.trim().toLowerCase();
		if (!q) {
			return pickList;
		}
		return pickList.filter((r) => r.fullName.toLowerCase().includes(q));
	}, [pickList, pickSearch]);

	if (loading || !data) {
		return (
			<div className="settings-root">
				<p className="muted">Loading…</p>
			</div>
		);
	}

	const { auth, settings, recentEvents } = data;
	const selectedRepoMeta =
		data.repos.find((r) => r.fullName === settings.selectedRepoFullName) ??
		null;

	return (
		<div className="settings-root">
			<h1 className="settings-brand">CssHub</h1>
			<p className="settings-tagline">
				Sync CSSBattle submissions to GitHub — configure account and repository here.
			</p>

			{error ? <p className="error-text">{error}</p> : null}
			{notice ? (
				<p className={`notice notice-${notice.level}`}>{notice.message}</p>
			) : null}

			<section className="settings-section">
				<h2>GitHub account</h2>
				{auth.isAuthenticated ? (
					<>
						<p className="muted">
							Signed in as <strong className="mono">{auth.username}</strong>
							{" · "}
							<span className="mono">{auth.method ?? "?"}</span>
						</p>
						<div className="btn-stack">
							<button type="button" className="btn btn-ghost" onClick={logout} disabled={busy}>
								Disconnect GitHub
							</button>
							<button type="button" className="btn btn-ghost" onClick={() => void loadState()} disabled={busy}>
								Refresh
							</button>
						</div>
					</>
				) : (
					<>
						<p className="muted">Choose how to connect:</p>
						<div className="btn-stack">
							<button type="button" className="btn btn-primary" onClick={beginWebFlow} disabled={busy}>
								Web OAuth
							</button>
							<button type="button" className="btn" onClick={beginDeviceFlow} disabled={busy}>
								Device code
							</button>
						</div>
						{deviceFlow ? (
							<div className="device-flow">
								<p>
									Code: <strong>{deviceFlow.userCode}</strong>
								</p>
								<button type="button" className="btn btn-primary" onClick={() => void pollDevice()} disabled={busy}>
									I approved — finish login
								</button>
							</div>
						) : null}
						<div className="row" style={{ marginTop: "1rem" }}>
							<label htmlFor="pat-settings">Personal access token</label>
							<input
								id="pat-settings"
								type="password"
								autoComplete="off"
								placeholder="github_pat_…"
								value={patToken}
								onChange={(e) => setPatToken(e.target.value)}
							/>
						</div>
						<button type="button" className="btn" onClick={loginPat} disabled={busy}>
							Sign in with token
						</button>
						<p className="hint">
							Web OAuth callback URL (add this exact URL to your GitHub OAuth app):{" "}
							<code className="mono">{oauthRedirectHint()}</code>
						</p>
					</>
				)}
			</section>

			<section className="settings-section">
				<h2>Repository</h2>
				{!auth.isAuthenticated ? (
					<p className="muted">Connect GitHub first.</p>
				) : settings.selectedRepoFullName ? (
					<>
						<p className="mono" style={{ color: "#f8fafc", marginBottom: "0.35rem" }}>
							{settings.selectedRepoFullName}
						</p>
						<p className="muted">
							Branch:{" "}
							<strong className="mono">
								{settings.selectedBranch ?? selectedRepoMeta?.defaultBranch ?? "main"}
							</strong>
						</p>
						<div className="btn-stack">
							<button type="button" className="btn" onClick={openPickModal} disabled={busy}>
								Change repository…
							</button>
							<button type="button" className="btn btn-ghost" onClick={() => void clearRepoSelection()} disabled={busy}>
								Clear selection
							</button>
							<button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)} disabled={busy}>
								Create new…
							</button>
						</div>
						{branchesLoading ? (
							<p className="muted" style={{ marginTop: "0.75rem" }}>
								Loading branches…
							</p>
						) : null}
						<div className="row" style={{ marginTop: "1rem" }}>
							<label htmlFor="branch-settings">Sync branch</label>
							<select
								id="branch-settings"
								value={settings.selectedBranch ?? ""}
								disabled={busy || branchesLoading || branches.length === 0}
								onChange={(e) => {
									const nextBranch = e.target.value || null;
									void saveSettingsRemote({ ...settings, selectedBranch: nextBranch });
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
						<div className="row">
							<label htmlFor="branch-create-name">Create new branch</label>
							<input
								id="branch-create-name"
								type="text"
								placeholder="feature/my-branch"
								value={createBranchName}
								onChange={(e) => setCreateBranchName(e.target.value)}
								disabled={busy || branchesLoading}
							/>
						</div>
						<div className="row">
							<label htmlFor="branch-create-from">From branch</label>
							<select
								id="branch-create-from"
								value={createBranchFrom}
								onChange={(e) => setCreateBranchFrom(e.target.value)}
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
						<button type="button" className="btn" onClick={() => void confirmCreateBranch()} disabled={busy || branchesLoading || branches.length === 0}>
							Create branch
						</button>
					</>
				) : (
					<>
						<p className="muted">No repository selected for sync.</p>
						<div className="btn-stack">
							<button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)} disabled={busy}>
								Create repository…
							</button>
							<button type="button" className="btn" onClick={openPickModal} disabled={busy}>
								Choose existing…
							</button>
						</div>
					</>
				)}
			</section>

			<section className="settings-section">
				<h2>Activity log</h2>
				<p className="muted">
					Operational timeline only. Technical debug details are intentionally hidden.
				</p>
				<div className="btn-stack">
					<button type="button" className="btn btn-ghost" onClick={() => void clearActivityLog()} disabled={busy || recentEvents.length === 0}>
						Clear log
					</button>
				</div>
				{recentEvents.length === 0 ? (
					<p className="empty-state">No events yet.</p>
				) : (
					<ul className="event-list">
						{recentEvents.map((ev) => (
							<li key={ev.id} className={`event event-${ev.level} ${ev.code === "SYNC_SKIPPED_NOT_IMPROVED" ? "event-best-kept" : ""}`}>
								<span>{new Date(ev.timestamp).toLocaleString()}</span>
								{ev.code === "SYNC_SKIPPED_NOT_IMPROVED" ? (
									<span className="event-pill">best result kept</span>
								) : null}
								<span>{ev.message}</span>
								{ev.commitUrl ? (
									<a href={ev.commitUrl} target="_blank" rel="noreferrer" style={{ color: "#38bdf8" }}>
										View commit
									</a>
								) : null}
							</li>
						))}
					</ul>
				)}
			</section>

			{createOpen ? (
				<div className="modal-backdrop" role="presentation" onClick={() => setCreateOpen(false)}>
					<div className="modal-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
						<div className="modal-head">Create repository</div>
						<div className="modal-body">
							<div className="row">
								<label htmlFor="cr-name">Name</label>
								<input
									id="cr-name"
									type="text"
									value={createName}
									onChange={(e) => setCreateName(e.target.value)}
									placeholder="my-cssbattles"
								/>
							</div>
							<div className="row checkbox-row">
								<label htmlFor="cr-priv">Private</label>
								<input
									id="cr-priv"
									type="checkbox"
									checked={createPrivate}
									onChange={(e) => setCreatePrivate(e.target.checked)}
								/>
							</div>
						</div>
						<div className="modal-foot">
							<button type="button" className="btn btn-ghost" onClick={() => setCreateOpen(false)}>
								Cancel
							</button>
							<button type="button" className="btn btn-primary" onClick={() => void confirmCreateRepo()} disabled={busy}>
								Create
							</button>
						</div>
					</div>
				</div>
			) : null}

			{pickOpen ? (
				<div className="modal-backdrop" role="presentation" onClick={() => setPickOpen(false)}>
					<div className="modal-panel" role="dialog" onClick={(e) => e.stopPropagation()}>
						<div className="modal-head">Choose repository</div>
						<div className="modal-body">
							<div className="row">
								<label htmlFor="pick-q">Search</label>
								<input
									id="pick-q"
									type="text"
									value={pickSearch}
									onChange={(e) => setPickSearch(e.target.value)}
									placeholder="owner/repo…"
								/>
							</div>
							<div className="repo-picker-list">
								{filteredPickList.map((r) => (
									<button
										key={r.id}
										type="button"
										className={`repo-picker-item ${pickSelected?.id === r.id ? "selected" : ""}`}
										onClick={() => setPickSelected(r)}
									>
										{r.fullName}
										{r.private ? " · private" : ""}
									</button>
								))}
							</div>
							{filteredPickList.length === 0 ? (
								<p className="empty-state">No matches.</p>
							) : null}
						</div>
						<div className="modal-foot">
							<button type="button" className="btn btn-ghost" onClick={() => setPickOpen(false)}>
								Cancel
							</button>
							<button type="button" className="btn btn-primary" onClick={() => void confirmPickRepo()} disabled={busy || !pickSelected}>
								Use repository
							</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
};

const container = document.getElementById("root");
if (!container) {
	throw new Error("Settings root missing");
}

createRoot(container).render(<App />);
