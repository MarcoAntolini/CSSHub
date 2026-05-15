import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import type { ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Toaster, toast } from "sonner";
import "sonner/dist/styles.css";

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

	const [patToken, setPatToken] = useState("");
	const [patTutorialOpen, setPatTutorialOpen] = useState(false);
	const [readmeInfoOpen, setReadmeInfoOpen] = useState(false);
	const [deviceFlow, setDeviceFlow] = useState<{
		deviceCode: string;
		userCode: string;
		verificationUri: string;
		verificationUriComplete: string | null;
		interval: number;
	} | null>(null);
	const [deviceCopyOk, setDeviceCopyOk] = useState(false);
	const deviceCopyOkTimerRef = useRef<number | null>(null);

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
		if (payload.level === "success") {
			toast.success(payload.message);
			return;
		}
		if (payload.level === "error") {
			toast.error(payload.message);
			return;
		}
		toast.warning(payload.message);
	}, []);

	const loadState = useCallback(async (): Promise<void> => {
		setLoading(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "getExtensionState",
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Failed to load settings",
			});
			setLoading(false);
			return;
		}
		const parsed = extensionStateResponseSchema.safeParse(response.data);
		if (!parsed.success) {
			pushToast({
				level: "error",
				message: "Invalid server response",
			});
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
	}, [pushToast]);

	useEffect(() => {
		void loadState();
	}, [loadState]);

	useEffect(() => {
		if (!deviceFlow) {
			setDeviceCopyOk(false);
			if (deviceCopyOkTimerRef.current !== null) {
				window.clearTimeout(deviceCopyOkTimerRef.current);
				deviceCopyOkTimerRef.current = null;
			}
		}
	}, [deviceFlow]);

	useEffect(() => {
		return () => {
			if (deviceCopyOkTimerRef.current !== null) {
				window.clearTimeout(deviceCopyOkTimerRef.current);
			}
		};
	}, []);

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
		const message = popupToBackgroundMessageSchema.parse({
			action: "saveSettings",
			settings: next,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Could not save settings",
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
			pushToast({
				level: "error",
				message: response?.error ?? "Could not list repositories",
			});
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
			pushToast({
				level: "error",
				message: response?.error ?? "Could not list branches",
			});
			return [];
		}
		const parsed = branchSchema.array().safeParse(response.data);
		return parsed.success ? parsed.data : [];
	};

	const beginWebFlow = async (): Promise<void> => {
		setDeviceFlow(null);
		setBusy(true);
		setWebAuthInProgress(true);
		try {
			const message = popupToBackgroundMessageSchema.parse({
				action: "startGithubWebFlow",
			});
			const response = await chrome.runtime.sendMessage(message);
			if (!response?.ok) {
				pushToast({
					level: "error",
					message: response?.error ?? "Web OAuth failed",
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
		setWebAuthInProgress(false);
		setDeviceCopyOk(false);
		if (deviceCopyOkTimerRef.current !== null) {
			window.clearTimeout(deviceCopyOkTimerRef.current);
			deviceCopyOkTimerRef.current = null;
		}
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "startGithubDeviceFlow",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Device flow failed",
			});
			return;
		}
		const payload = deviceFlowStartResponseSchema.safeParse(response.data);
		if (!payload.success) {
			pushToast({
				level: "error",
				message: "Invalid device flow response",
			});
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
		const message = popupToBackgroundMessageSchema.parse({
			action: "pollGithubDeviceFlow",
			deviceCode: deviceFlow.deviceCode,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Polling failed",
			});
			return;
		}
		if (response.data?.status === "pending") {
			pushToast({
				level: "warn",
				message: "Approve the device login on GitHub first, then try again.",
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

	const copyDeviceUserCode = async (): Promise<void> => {
		if (!deviceFlow) {
			return;
		}
		try {
			await navigator.clipboard.writeText(deviceFlow.userCode);
			pushToast({
				level: "success",
				message: "User code copied",
			});
			setDeviceCopyOk(true);
			if (deviceCopyOkTimerRef.current !== null) {
				window.clearTimeout(deviceCopyOkTimerRef.current);
			}
			deviceCopyOkTimerRef.current = window.setTimeout(() => {
				setDeviceCopyOk(false);
				deviceCopyOkTimerRef.current = null;
			}, 2500);
		} catch {
			pushToast({
				level: "warn",
				message: "Could not copy — select the code manually",
			});
		}
	};

	const openDeviceVerification = (): void => {
		if (!deviceFlow) {
			return;
		}
		void chrome.tabs.create({
			url: deviceFlow.verificationUriComplete ?? deviceFlow.verificationUri,
		});
	};

	const loginPat = async (): Promise<void> => {
		if (!patToken.trim()) {
			pushToast({
				level: "warn",
				message: "Paste a token",
			});
			return;
		}
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "loginWithPat",
			token: patToken.trim(),
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "PAT login failed",
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
		const message = popupToBackgroundMessageSchema.parse({
			action: "logoutGithub",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Logout failed",
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
		const message = popupToBackgroundMessageSchema.parse({
			action: "clearRecentEvents",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Could not clear activity log",
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
			pushToast({
				level: "warn",
				message: "Repository name required",
			});
			return;
		}
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "createRepo",
			name: createName.trim(),
			private: createPrivate,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Repository creation failed",
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
			pushToast({
				level: "warn",
				message: "Select a repository first",
			});
			return;
		}

		const newBranchName = createBranchName.trim();
		const existing = new Set(branches.map((branch) => branch.name));
		const validationError = validateBranchName(newBranchName, existing);
		if (validationError) {
			pushToast({
				level: "warn",
				message: validationError,
			});
			return;
		}

		const repoMeta =
			data.repos.find((r) => r.fullName === data.settings.selectedRepoFullName) ?? null;
		const fromBranch =
			createBranchFrom ||
			data.settings.selectedBranch ||
			repoMeta?.defaultBranch ||
			branches[0]?.name ||
			"";
		if (!fromBranch) {
			pushToast({
				level: "warn",
				message: "No source branch available",
			});
			return;
		}

		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "createBranch",
			repoFullName: data.settings.selectedRepoFullName,
			newBranch: newBranchName,
			fromBranch,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Branch creation failed",
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
			<>
				{createPortal(
					<Toaster theme="dark" richColors position="top-center" closeButton />,
					document.body,
				)}
				<div className="settings-root">
					<p className="muted">Loading…</p>
				</div>
			</>
		);
	}

	const { auth, settings, recentEvents } = data;
	const selectedRepoMeta =
		data.repos.find((r) => r.fullName === settings.selectedRepoFullName) ??
		null;

	return (
		<>
			{createPortal(
				<Toaster theme="dark" richColors position="top-center" closeButton />,
				document.body,
			)}
			<div className="settings-root">
				<h1 className="settings-brand">CssHub</h1>
				<p className="settings-tagline">
					Sync CSSBattle submissions to GitHub — configure account and repository here.
				</p>

				<section className="settings-section">
				<h2>GitHub account</h2>
				{auth.isAuthenticated ? (
					<>
						<p className="muted">
							Signed in as <strong className="mono">{auth.username}</strong>
						</p>
						<div className="btn-stack">
							<button type="button" className="btn btn-ghost" onClick={logout} disabled={busy}>
								Disconnect GitHub
							</button>
						</div>
					</>
				) : (
					<>
						<p className="muted auth-methods-intro">Pick any method — they all grant the same access CssHub needs.</p>
						<div className="auth-methods" role="list">
							<div className="auth-method-card" role="listitem">
								<div className="auth-method-head">
									<h3 className="auth-method-title">Browser sign-in</h3>
								</div>
								<div className="auth-method-actions">
									<button
										type="button"
										className="btn btn-primary btn-auth-browser"
										onClick={() => void beginWebFlow()}
										disabled={busy || webAuthInProgress}
										aria-busy={webAuthInProgress}
										aria-label={webAuthInProgress ? "Connecting with GitHub" : undefined}
									>
										<span className={webAuthInProgress ? "btn-auth-browser-label is-busy" : "btn-auth-browser-label"}>
											Continue with GitHub
										</span>
										{webAuthInProgress ? (
											<span className="btn-auth-browser-busy" aria-hidden="true">
												<span className="btn-spinner" />
											</span>
										) : null}
									</button>
									<p className="hint auth-trust-line" role="note">
										OAuth runs on github.com. This extension never receives your GitHub password.
									</p>
								</div>
							</div>

							<div className="auth-method-card" role="listitem">
								<div className="auth-method-head">
									<h3 className="auth-method-title">Device code</h3>
									<p className="auth-method-desc">
										Use when browser OAuth is blocked. We open GitHub with your code when GitHub supports it.
									</p>
								</div>
								<div className="auth-method-actions">
									{deviceFlow ? (
										<div className="device-flow">
											<ol className="device-flow-steps">
												<li>Complete the prompt in the GitHub tab (we opened one when you started).</li>
												<li>Confirm the user code below matches GitHub if you are asked to enter it.</li>
												<li>After you authorize CssHub, finish here.</li>
											</ol>
											<p className="device-flow-label">Your user code</p>
											<div className="device-user-code-shell">
												<div className="device-user-code-inner" translate="no" aria-label="GitHub device user code">
													{deviceFlow.userCode.split("-").map((part, i) => (
														<span key={i} className="device-user-code-group">
															{i > 0 ? (
																<span className="device-user-code-sep" aria-hidden="true">
																	-
																</span>
															) : null}
															<span className="device-user-code-chunk">{part}</span>
														</span>
													))}
												</div>
												<button
													type="button"
													className={`device-copy-icon-btn${deviceCopyOk ? " device-copy-icon-btn--ok" : ""}`}
													onClick={() => void copyDeviceUserCode()}
													disabled={busy}
													aria-label="Copy user code to clipboard"
													data-tooltip={deviceCopyOk ? "Copied" : "Copy text"}
												>
													<svg
														className="device-copy-icon"
														width="18"
														height="18"
														viewBox="0 0 24 24"
														fill="none"
														stroke="currentColor"
														strokeWidth="2"
														strokeLinecap="round"
														strokeLinejoin="round"
														aria-hidden="true"
													>
														<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
														<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
													</svg>
												</button>
											</div>
											<div className="device-flow-link-row">
												<button
													type="button"
													className="device-github-again-link"
													onClick={openDeviceVerification}
													disabled={busy}
												>
													Open GitHub again
												</button>
											</div>
											<button type="button" className="btn btn-primary device-flow-finish" onClick={() => void pollDevice()} disabled={busy}>
												I authorized CssHub — finish sign-in
											</button>
										</div>
									) : (
										<button type="button" className="btn" onClick={() => void beginDeviceFlow()} disabled={busy || webAuthInProgress}>
											Start device sign-in
										</button>
									)}
								</div>
							</div>

							<div className="auth-method-card" role="listitem">
								<div className="auth-method-head">
									<div className="auth-method-title-row">
										<h3 className="auth-method-title">Personal access token</h3>
										<button
											type="button"
											className="help-badge"
											aria-expanded={patTutorialOpen}
											aria-controls="pat-tutorial-panel"
											onClick={() => setPatTutorialOpen((open) => !open)}
											title="How to create a token"
										>
											?
										</button>
									</div>
									<p className="auth-method-desc">Paste a classic or fine-grained token. It stays in this browser profile only.</p>
								</div>
								{patTutorialOpen ? (
									<div className="pat-tutorial" id="pat-tutorial-panel" role="region" aria-label="Personal access token instructions">
										<ol>
											<li>
												On GitHub, open{" "}
												<strong>Settings → Developer settings → Personal access tokens</strong> (classic or fine-grained).
											</li>
											<li>
												<strong>Classic token:</strong> enable scopes <code className="pat-tutorial-code">repo</code> and{" "}
												<code className="pat-tutorial-code">read:user</code> (same access as browser sign-in).
											</li>
											<li>
												<strong>Fine-grained token:</strong> pick repositories CssHub should sync to and grant{" "}
												<strong>Contents</strong> read/write (and metadata as prompted).
											</li>
											<li>Generate the token, copy it once, paste below, then choose Sign in with token.</li>
										</ol>
									</div>
								) : null}
								<div className="auth-method-actions">
									<div className="row row-tight">
										<label htmlFor="pat-settings">Token</label>
										<input
											id="pat-settings"
											type="password"
											autoComplete="off"
											placeholder="github_pat_… or ghp_…"
											value={patToken}
											onChange={(e) => setPatToken(e.target.value)}
											disabled={busy || webAuthInProgress}
										/>
									</div>
									<button type="button" className="btn" onClick={() => void loginPat()} disabled={busy || webAuthInProgress}>
										Sign in with token
									</button>
								</div>
							</div>
						</div>
					</>
				)}
			</section>

			<section className="settings-section">
				<h2>Repository</h2>
				{!auth.isAuthenticated ? (
					<p className="muted">Connect GitHub first.</p>
				) : settings.selectedRepoFullName ? (
					<>
						<div className="repo-panel">
							<div className="repo-panel-meta">
								<p className="repo-fullname">{settings.selectedRepoFullName}</p>
								<p className="repo-branch-line">
									Branch:{" "}
									<strong className="repo-branch-name">
										{settings.selectedBranch ?? selectedRepoMeta?.defaultBranch ?? "main"}
									</strong>
								</p>
							</div>
							<div className="repo-panel-toolbar" role="group" aria-label="Repository actions">
								<div className="repo-toolbar-start">
									<button type="button" className="btn btn-ghost repo-panel-btn" onClick={openPickModal} disabled={busy}>
										Change repository…
									</button>
									<button type="button" className="btn btn-ghost repo-panel-btn" onClick={() => void clearRepoSelection()} disabled={busy}>
										Clear selection
									</button>
								</div>
								<button type="button" className="btn btn-primary repo-panel-btn repo-toolbar-primary" onClick={() => setCreateOpen(true)} disabled={busy}>
									Create new…
								</button>
							</div>
						</div>
						{branchesLoading ? <p className="repo-branches-hint muted">Loading branches…</p> : null}
						<div className="branch-workspace">
							<p className="branch-workspace-title">Branches</p>
							<div className="branch-sync-panel">
								<div className="row">
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
								</div>
							</div>
							<div className="branch-workspace-foot">
								<button
									type="button"
									className="btn btn-primary branch-create-submit"
									onClick={() => void confirmCreateBranch()}
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
									onClick={() => setReadmeInfoOpen((open) => !open)}
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
										<strong>Managed section</strong> (default) updates only the region between these
										markers in the repository root <code className="readme-info-code">README.md</code>:
									</p>
									<pre className="readme-info-markers">{`<!-- CSSHUB:README-START -->
(list of challenge links)
<!-- CSSHUB:README-END -->`}</pre>
									<p>Text above or below that block is never touched. Each sync refreshes the index in the same commit as your solution.</p>
									<p>
										<strong>Full</strong> replaces the entire root README on every sync.
									</p>
									<p>
										<strong>Off</strong> leaves root README.md unchanged (challenge folders still get their own READMEs).
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
										if (v === "off" || v === "managed-section" || v === "full") {
											void saveSettingsRemote({ ...settings, repositoryReadmeMode: v });
										}
									}}
								>
									<option value="off">Off — never change root README.md</option>
									<option value="managed-section">Managed section (recommended)</option>
									<option value="full">Full — replace entire README.md</option>
								</select>
							</div>
						</div>
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
		</>
	);
};

const container = document.getElementById("root");
if (!container) {
	throw new Error("Settings root missing");
}

createRoot(container).render(<App />);
