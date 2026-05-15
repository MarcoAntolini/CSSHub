import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import "../public/popup.css";
import { Toaster, toast } from "sonner";
import "sonner/dist/styles.css";
import {
	extensionStateResponseSchema,
	popupToBackgroundMessageSchema,
	type AuthStatus,
	type ExtensionSettings,
	type SubmissionIngestionResponse,
	type SubmissionPayload,
} from "./shared/contracts";
import { getIngestionTone, type StatusTone } from "./shared/eventTone";

const THRESHOLD_MIN = 0;
const THRESHOLD_MAX = 100;
const THRESHOLD_SAVE_DEBOUNCE_MS = 400;
const SHOW_STATUS_DEMO = false;
const POPUP_ERRORS = {
	loadState: "Could not load popup state",
	saveThreshold: "Could not update threshold",
} as const;

type SubmissionCardView = {
	title: string;
	meta: string;
	tone: StatusTone;
	statusText: string;
	reason: string;
	commitUrl?: string | null;
};

const STATUS_DEMO_CASES: Array<{ label: string; view: SubmissionCardView }> = [
	{
		label: "Commit success",
		view: {
			title: "Carrom",
			meta: "99.2% match · 640 score · just now",
			tone: "success",
			statusText: "committed",
			reason: "Submission committed to GitHub.",
			commitUrl: "#",
		},
	},
	{
		label: "Skipped · best kept",
		view: {
			title: "Carrom",
			meta: "98.5% match · 612 score · just now",
			tone: "warn",
			statusText: "skipped",
			reason:
				"Submission skipped: current 98.50% / 612 does not beat best 99.20% / 640.",
		},
	},
	{
		label: "Skipped · below threshold",
		view: {
			title: "Carrom",
			meta: "82.4% match · 380 score · just now",
			tone: "warn",
			statusText: "skipped",
			reason: "Submission below threshold.",
		},
	},
	{
		label: "Skipped · score is 0",
		view: {
			title: "Carrom",
			meta: "— · 0 score · just now",
			tone: "warn",
			statusText: "skipped",
			reason:
				"Submission skipped because Last score is zero, unavailable, or invalid.",
		},
	},
	{
		label: "Skipped · duplicate",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "warn",
			statusText: "skipped",
			reason:
				"Duplicate submission skipped: same challenge, code, and score within 45s window.",
		},
	},
	{
		label: "Action needed · auth missing",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "Submission accepted but GitHub is not authenticated.",
		},
	},
	{
		label: "Action needed · repo missing",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "Submission accepted but no repository selected.",
		},
	},
	{
		label: "Error · repo/branch not found",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "Repository or branch not found. Verify repository settings.",
		},
	},
	{
		label: "Error · GitHub rejected operation",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "GitHub rejected this operation. Check repository and branch.",
		},
	},
	{
		label: "Error · rate limit",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "GitHub rate limit reached. Retry in a few minutes.",
		},
	},
	{
		label: "Error · GitHub unavailable",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "GitHub is temporarily unavailable. Try again shortly.",
		},
	},
	{
		label: "Error · network",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "Network error while contacting GitHub services.",
		},
	},
	{
		label: "Error · unexpected",
		view: {
			title: "Carrom",
			meta: "97.1% match · 540 score · just now",
			tone: "error",
			statusText: "failed",
			reason: "Operation failed. Check settings and try again.",
		},
	},
];

const SubmissionCard = ({
	view,
}: {
	view: SubmissionCardView;
}): ReactElement => (
	<div className="last-card">
		<div className="last-row-head">
			<span className="last-title" title={view.title}>
				{view.title}
			</span>
			<span className={`last-status last-status-${view.tone}`}>
				{view.statusText}
			</span>
		</div>
		{view.meta ? <p className="last-meta">{view.meta}</p> : null}
		{view.reason ? (
			<p className={`last-reason last-reason-${view.tone}`}>{view.reason}</p>
		) : null}
		{view.commitUrl ? (
			<a
				href={view.commitUrl}
				target="_blank"
				rel="noreferrer"
				className="last-commit-link"
				onClick={(e) => {
					if (view.commitUrl === "#") {
						e.preventDefault();
					}
				}}
			>
				View commit ↗
			</a>
		) : null}
	</div>
);

const relativeTime = (iso: string): string | null => {
	const t = Date.parse(iso);
	if (!Number.isFinite(t)) {
		return null;
	}
	const diff = Date.now() - t;
	const sec = Math.max(0, Math.round(diff / 1000));
	if (sec < 5) return "just now";
	if (sec < 60) return `${sec}s ago`;
	const min = Math.round(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.round(min / 60);
	if (hr < 24) return `${hr}h ago`;
	const day = Math.round(hr / 24);
	return `${day}d ago`;
};

const clampThreshold = (value: number): number =>
	Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.round(value)));

const openSettingsPage = (): void => {
	// openOptionsPage() from the toolbar popup is flaky (popup closes and navigation may never run).
	// Same HTML as options_ui.page; tabs permission is declared in the manifest.
	const url = chrome.runtime.getURL("settings.html");
	void chrome.tabs.create({ url });
};

type PopupState = {
	auth: AuthStatus;
	settings: ExtensionSettings;
	lastSubmission: SubmissionPayload | null;
	lastSubmissionAccepted: boolean | null;
	lastIngestion: SubmissionIngestionResponse | null;
};

const App = (): ReactElement => {
	const [data, setData] = useState<PopupState | null>(null);
	const [loading, setLoading] = useState(true);
	const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
	const [thresholdDraft, setThresholdDraft] = useState(95);
	const hasLoadedOnceRef = useRef(false);

	const load = useCallback(async (): Promise<void> => {
		const shouldShowLoading = !hasLoadedOnceRef.current;
		if (shouldShowLoading) {
			setLoading(true);
		}
		const message = popupToBackgroundMessageSchema.parse({
			action: "getExtensionState",
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			toast.error(POPUP_ERRORS.loadState);
			if (shouldShowLoading) {
				setLoading(false);
			}
			setStatus("error");
			return;
		}
		const parsed = extensionStateResponseSchema.safeParse(response.data);
		if (!parsed.success) {
			toast.error(POPUP_ERRORS.loadState);
			if (shouldShowLoading) {
				setLoading(false);
			}
			setStatus("error");
			return;
		}
		setData({
			auth: parsed.data.auth,
			settings: parsed.data.settings,
			lastSubmission: parsed.data.lastSubmission,
			lastSubmissionAccepted: parsed.data.lastSubmissionAccepted,
			lastIngestion: parsed.data.lastIngestion,
		});
		setThresholdDraft(parsed.data.settings.threshold);
		hasLoadedOnceRef.current = true;
		if (shouldShowLoading) {
			setLoading(false);
		}
		setStatus("idle");
	}, []);

	useEffect(() => {
		if (!data) {
			return;
		}
		const current = data.settings.threshold;
		const next = clampThreshold(thresholdDraft);
		if (current === next) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			void saveThreshold(next);
		}, THRESHOLD_SAVE_DEBOUNCE_MS);
		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [thresholdDraft, data]);

	useEffect(() => {
		void load();
		const onStorageChanged = (): void => {
			void load();
		};
		chrome.storage.onChanged.addListener(onStorageChanged);
		return () => {
			chrome.storage.onChanged.removeListener(onStorageChanged);
		};
	}, [load]);

	const saveThreshold = async (threshold: number): Promise<void> => {
		if (!data) {
			return;
		}
		setStatus("saving");
		const message = popupToBackgroundMessageSchema.parse({
			action: "saveSettings",
			settings: { ...data.settings, threshold },
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setStatus("error");
			toast.error(response?.error ?? POPUP_ERRORS.saveThreshold);
			return;
		}
		setData({
			...data,
			settings: { ...data.settings, threshold: clampThreshold(threshold) },
		});
		setStatus("idle");
	};

	if (loading || !data) {
		return (
			<>
				{createPortal(
					<Toaster theme="dark" richColors position="top-center" closeButton />,
					document.body,
				)}
				<main className="popup popup-shell">
					<h1 className="popup-title">CssHub</h1>
					<p className="subtitle">
						{loading ? "Loading…" : "Something went wrong."}
					</p>
				</main>
			</>
		);
	}

	const { auth, settings, lastSubmission, lastIngestion } = data;
	const statusTone: StatusTone = getIngestionTone(lastIngestion);
	const statusText =
		statusTone === "success"
			? "committed"
			: statusTone === "error"
				? "failed"
				: statusTone === "warn"
					? "skipped"
					: "—";

	return (
		<>
			{createPortal(
				<Toaster theme="dark" richColors position="top-center" closeButton />,
				document.body,
			)}
			<main className="popup popup-shell">
			<header className="popup-header">
				<h1 className="popup-title">CssHub</h1>
				<button type="button" className="btn-link" onClick={openSettingsPage}>
					Settings
				</button>
			</header>

			{!auth.isAuthenticated ? <p className="subtitle">Not signed in</p> : null}

			{!auth.isAuthenticated ? (
				<section className="card">
					<p className="card-help">Sign in and pick a repo in Settings.</p>
					<button type="button" className="btn-full" onClick={openSettingsPage}>
						Open Settings
					</button>
				</section>
			) : (
				<>
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
								<span className="sync-target-repo">
									{settings.selectedRepoFullName}
								</span>
								<span className="sync-target-branch">
									· {settings.selectedBranch ?? "main"}
								</span>
							</a>
						) : (
							<p className="sync-target sync-target-empty">
								<span className="sync-target-label">No repo selected.</span>
								<button
									type="button"
									className="btn-link"
									onClick={openSettingsPage}
								>
									Set up in Settings
								</button>
							</p>
						)}
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
									setThresholdDraft(clampThreshold(thresholdDraft - 1))
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
										setThresholdDraft(clampThreshold(t));
									}
								}}
							/>
							<button
								type="button"
								className="threshold-step"
								aria-label="Increase threshold by 1"
								disabled={status === "saving" || thresholdDraft >= THRESHOLD_MAX}
								onClick={() =>
									setThresholdDraft(clampThreshold(thresholdDraft + 1))
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
					</section>

					<section className="card card-compact">
						<h2 className="card-heading">Last submission</h2>
						{lastSubmission ? (
							<SubmissionCard
								view={{
									title: lastSubmission.challengeName,
									meta: [
										lastSubmission.matchPct != null
											? `${lastSubmission.matchPct}% match`
											: null,
										lastSubmission.score != null
											? `${lastSubmission.score} score`
											: null,
										relativeTime(lastSubmission.submittedAt),
									]
										.filter((part): part is string => Boolean(part))
										.join(" · "),
									tone: statusTone,
									statusText,
									reason: lastIngestion?.reason ?? "",
									commitUrl: lastIngestion?.commitUrl ?? null,
								}}
							/>
						) : (
							<p className="last-empty">
								No submission yet. Submit on CSSBattle to see it here.
							</p>
						)}
					</section>
					{SHOW_STATUS_DEMO ? (
						<section className="card card-compact">
							<h2 className="card-heading">Status color demo</h2>
							<div className="demo-stack">
								{STATUS_DEMO_CASES.map((demoCase) => (
									<div key={demoCase.label} className="demo-case">
										<p className="demo-label">{demoCase.label}</p>
										<SubmissionCard view={demoCase.view} />
									</div>
								))}
							</div>
						</section>
					) : null}
				</>
			)}
		</main>
		</>
	);
};

const container = document.getElementById("root");
if (!container) {
	throw new Error("Popup root element not found");
}

createRoot(container).render(<App />);
