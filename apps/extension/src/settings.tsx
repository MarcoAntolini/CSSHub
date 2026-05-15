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
import { getSyncEventTone } from "./shared/eventTone";
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

type UiNotice = {
	level: "success" | "warn" | "error";
	message: string;
};
type UiToast = UiNotice & { id: number };
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]+$/;
const EVENT_BADGE_LABELS: Partial<Record<string, string>> = {
	SYNC_COMMITTED: "committed",
	SYNC_SKIPPED_DUPLICATE: "duplicate",
	SYNC_SKIPPED_THRESHOLD: "below threshold",
	SYNC_SKIPPED_NOT_IMPROVED: "best kept",
	SYNC_SKIPPED_INVALID_SCORE: "invalid score",
	SYNC_AUTH_REQUIRED: "auth required",
	SYNC_REPO_REQUIRED: "repo required",
	AUTH_STATE_MISMATCH: "oauth mismatch",
	AUTH_OAUTH_CODE_MISSING: "oauth code missing",
	AUTH_GITHUB_UNAUTHORIZED: "github auth failed",
	GITHUB_NOT_FOUND: "not found",
	GITHUB_CONFLICT: "github conflict",
	GITHUB_RATE_LIMIT: "rate limit",
	GITHUB_UNAVAILABLE: "github unavailable",
	NETWORK_ERROR: "network error",
	UNEXPECTED_ERROR: "unexpected error",
};

const getEventBadgeLabel = (event: SyncEvent): string => {
	if (event.code) {
		return EVENT_BADGE_LABELS[event.code] ?? event.code.toLowerCase().replace(/_/g, " ");
	}
	return event.level === "info" ? "info" : event.level;
};

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
	const [webAuthInProgress, setWebAuthInProgress] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<UiToast | null>(null);

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

	const pushToast = useCallback((payload: UiNotice): void => {
		setToast({
			...payload,
			id: Date.now(),
		});
	}, []);

	useEffect(() => {
		if (!toast) {
			return;
		}
		const timeout = window.setTimeout(() => {
			setToast((current) => (current?.id === toast.id ? null : current));
		}, 3200);
		return () => {
			window.clearTimeout(timeout);
		};
	}, [toast]);

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
			pushToast({
				level: "error",
				message: "Could not save settings",
			});
			return false;
		}
		setData((prev) => (prev ? { ...prev, settings: next } : prev));
		pushToast({
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
		setWebAuthInProgress(true);
		setError(null);
		try {
			const message = popupToBackgroundMessageSchema.parse({
				action: "startGithubWebFlow",
			});
			const response = await chrome.runtime.sendMessage(message);
			if (!response?.ok) {
				setError(response?.error ?? "Web OAuth failed");
				pushToast({
					level: "error",
					message: "Web OAuth failed",
				});
				return;
			}
			pushToast({
				level: "success",
				message: "GitHub account connected",
			});
			await loadState();
		} finally {
			setBusy(false);
			setWebAuthInProgress(false);
		}
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
			pushToast({
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
			pushToast({
				level: "error",
				message: "Polling failed",
			});
			return;
		}
		if (response.data?.status === "pending") {
			setError("Still waiting — approve on GitHub first.");
			pushToast({
				level: "warn",
				message: "Waiting for GitHub approval",
			});
			return;
		}
		if (response.data?.status === "authenticated") {
			setDeviceFlow(null);
			pushToast({
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
			pushToast({
				level: "error",
				message: "PAT login failed",
			});
			return;
		}
		setPatToken("");
		pushToast({
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
			pushToast({
				level: "error",
				message: "Logout failed",
			});
			return;
		}
		setDeviceFlow(null);
		pushToast({
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
			pushToast({
				level: "error",
				message: "Could not clear activity log",
			});
			return;
		}
		setData((prev) => (prev ? { ...prev, recentEvents: [] } : prev));
		pushToast({
			level: "success",
			message: "Activity log cleared",
		});
	};

	const toggleSystemNotifications = async (enabled: boolean): Promise<void> => {
		if (!data) {
			return;
		}
		await saveSettingsRemote({
			...data.settings,
			systemNotificationsEnabled: enabled,
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
			pushToast({
				level: "error",
				message: "Repository creation failed",
			});
			return;
		}
		setCreateOpen(false);
		setCreateName("");
		pushToast({
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
			pushToast({
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
			pushToast({
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
			pushToast({
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
		pushToast({
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
			{toast ? (
				<div className={`settings-toast settings-toast-${toast.level}`} role="status" aria-live="polite">
					{toast.message}
				</div>
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
						</div>
					</>
				) : (
					<>
						<p className="muted">Choose how to connect:</p>
						<div className="btn-stack">
							<button type="button" className="btn btn-primary" onClick={beginWebFlow} disabled={busy || webAuthInProgress}>
								{webAuthInProgress ? "Connecting GitHub…" : "Web OAuth"}
							</button>
							<button type="button" className="btn" onClick={beginDeviceFlow} disabled={busy || webAuthInProgress}>
								Device code
							</button>
						</div>
						{webAuthInProgress ? (
							<p className="auth-progress">
								<span className="spinner" aria-hidden="true" />
								Connecting GitHub…
							</p>
						) : null}
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
								disabled={busy || webAuthInProgress}
							/>
						</div>
						<button type="button" className="btn" onClick={loginPat} disabled={busy || webAuthInProgress}>
							Sign in with token
						</button>
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
				<h2>Notifications</h2>
				<div className="toggle-row">
					<div>
						<p className="toggle-title">Browser/system notifications</p>
						<p className="muted">
							Show desktop notifications from the extension. In-app badges and activity log remain active.
						</p>
					</div>
					<label className="switch" htmlFor="system-notifications-toggle">
						<input
							id="system-notifications-toggle"
							type="checkbox"
							checked={settings.systemNotificationsEnabled}
							disabled={busy}
							onChange={(e) => {
								void toggleSystemNotifications(e.target.checked);
							}}
						/>
						<span className="switch-slider" />
					</label>
				</div>
			</section>

			<section className="settings-section">
				<div className="section-headline">
					<h2>Activity log</h2>
					<button type="button" className="btn btn-ghost btn-small" onClick={() => void clearActivityLog()} disabled={busy || recentEvents.length === 0}>
						Clear log
					</button>
				</div>
				<p className="muted">
					Operational timeline only. Technical debug details are intentionally hidden.
				</p>
				{recentEvents.length === 0 ? (
					<p className="empty-state empty-state-activity">No events yet.</p>
				) : (
					<ul className="event-list">
						{recentEvents.map((ev) => {
							const tone = getSyncEventTone(ev);
							return (
								<li key={ev.id} className={`event event-tone-${tone}`}>
									<span>{new Date(ev.timestamp).toLocaleString()}</span>
									<span className={`event-pill event-pill-${tone}`}>
										{getEventBadgeLabel(ev)}
									</span>
									<span>{ev.message}</span>
									{ev.commitUrl ? (
										<a href={ev.commitUrl} target="_blank" rel="noreferrer" className={`event-link event-link-${tone}`}>
											View commit
										</a>
									) : null}
								</li>
							);
						})}
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
