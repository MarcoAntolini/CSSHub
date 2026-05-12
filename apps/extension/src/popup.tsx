import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	extensionStateResponseSchema,
	popupToBackgroundMessageSchema,
	type AuthStatus,
	type ExtensionSettings,
	type SubmissionIngestionResponse,
	type SubmissionPayload,
} from "./shared/contracts";
import "../public/popup.css";

const previewSelector = "iframe[title*='Preview' i]";
const THRESHOLD_MIN = 0;
const THRESHOLD_MAX = 100;
const THRESHOLD_SAVE_DEBOUNCE_MS = 400;
const POPUP_ERRORS = {
	loadState: "Could not load popup state",
	saveThreshold: "Could not update threshold",
	manualCapture: "Manual preview capture failed",
} as const;

type PopupNotice = {
	level: "success" | "warn" | "error";
	message: string;
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
	const [status, setStatus] = useState<"idle" | "capturing" | "saving" | "error">("idle");
	const [error, setError] = useState<string | null>(null);
	const [capturePreview, setCapturePreview] = useState<string | null>(null);
	const [thresholdDraft, setThresholdDraft] = useState(95);
	const [notice, setNotice] = useState<PopupNotice | null>(null);
	const hasLoadedOnceRef = useRef(false);

	const load = useCallback(async (): Promise<void> => {
		const shouldShowLoading = !hasLoadedOnceRef.current;
		if (shouldShowLoading) {
			setLoading(true);
		}
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "getExtensionState",
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setError(POPUP_ERRORS.loadState);
			if (shouldShowLoading) {
				setLoading(false);
			}
			setStatus("error");
			return;
		}
		const parsed = extensionStateResponseSchema.safeParse(response.data);
		if (!parsed.success) {
			setError(POPUP_ERRORS.loadState);
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
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "saveSettings",
			settings: { ...data.settings, threshold },
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setStatus("error");
			setNotice({
				level: "error",
				message: POPUP_ERRORS.saveThreshold,
			});
			return;
		}
		setData({ ...data, settings: { ...data.settings, threshold: clampThreshold(threshold) } });
		setNotice({
			level: "success",
			message: `Threshold saved at ${clampThreshold(threshold)}%`,
		});
		setStatus("idle");
	};

	const handleCapture = async (): Promise<void> => {
		const message = popupToBackgroundMessageSchema.parse({
			action: "captureElement",
			selector: previewSelector,
		});
		setStatus("capturing");
		setError(null);
		setCapturePreview(null);

		try {
			const response = await chrome.runtime.sendMessage(message);
			if (!response?.ok || typeof response.data?.croppedDataUrl !== "string") {
				setStatus("error");
				setNotice({
					level: "error",
					message: POPUP_ERRORS.manualCapture,
				});
				return;
			}
			setCapturePreview(response.data.croppedDataUrl);
			setNotice({
				level: "success",
				message: "Manual preview capture completed",
			});
			setStatus("idle");
		} catch (_err) {
			setStatus("error");
			setNotice({
				level: "error",
				message: POPUP_ERRORS.manualCapture,
			});
		}
	};

	if (loading || !data) {
		return (
			<main className="popup popup-shell">
				<h1 className="popup-title">CssHub</h1>
				<p className="subtitle">{loading ? "Loading…" : "Something went wrong."}</p>
			</main>
		);
	}

	const { auth, settings, lastSubmission, lastSubmissionAccepted, lastIngestion } = data;

	return (
		<main className="popup popup-shell">
			<header className="popup-header">
				<h1 className="popup-title">CssHub</h1>
				<button type="button" className="btn-link" onClick={openSettingsPage}>
					Settings
				</button>
			</header>

			{!auth.isAuthenticated ? <p className="subtitle">Not signed in</p> : null}

			{error ? <p className="error">{error}</p> : null}
			{notice ? (
				<p className={`notice notice-${notice.level}`}>{notice.message}</p>
			) : null}

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
						<p className="card-help">
							On CSSBattle submit, CssHub automatically captures preview and sends data.
						</p>
						<label className="field-label" htmlFor="thr">
							Match threshold (%)
						</label>
						<div className="threshold-row">
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
							<input
								className="field-input field-threshold-number"
								type="number"
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
						</div>
						<p className="muted">Saved value: {settings.threshold}%</p>
						<button
							type="button"
							className="btn-full"
							onClick={() => void handleCapture()}
							disabled={status === "capturing"}
						>
							{status === "capturing"
								? "Running manual test…"
								: "Run manual preview capture test"}
						</button>
						{capturePreview ? (
							<img
								src={capturePreview}
								alt="Captured CSSBattle preview"
								className="capture-preview"
							/>
						) : null}
					</section>

					<section className="card card-compact">
						<h2 className="card-heading">Last submission</h2>
						{lastSubmission ? (
							<div className="last-grid">
								<span>{lastSubmission.challengeName}</span>
								<span className="muted">
									{lastSubmission.matchPct != null ? `${lastSubmission.matchPct}%` : "—"}
								</span>
								<span className="muted">
									{lastSubmissionAccepted ? "accepted" : "skipped"}
								</span>
								<span className="last-result muted">{lastIngestion?.reason ?? ""}</span>
								{lastIngestion?.commitUrl ? (
									<a href={lastIngestion.commitUrl} target="_blank" rel="noreferrer" className="commit-link">
										Commit
									</a>
								) : null}
							</div>
						) : (
							<p className="muted">None yet.</p>
						)}
						<button type="button" className="btn-secondary-full btn-tiny-margin" onClick={() => void load()}>
							Refresh
						</button>
					</section>
				</>
			)}
		</main>
	);
};

const container = document.getElementById("root");
if (!container) {
	throw new Error("Popup root element not found");
}

createRoot(container).render(<App />);
