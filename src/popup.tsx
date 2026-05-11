import { createRoot } from "react-dom/client";
import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
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

	const load = useCallback(async (): Promise<void> => {
		setLoading(true);
		setError(null);
		const message = popupToBackgroundMessageSchema.parse({
			action: "getExtensionState",
		});
		const response = await chrome.runtime.sendMessage(message);
		if (!response?.ok) {
			setError(response?.error ?? "Could not load");
			setLoading(false);
			setStatus("error");
			return;
		}
		const parsed = extensionStateResponseSchema.safeParse(response.data);
		if (!parsed.success) {
			setError("Invalid response");
			setLoading(false);
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
		setLoading(false);
		setStatus("idle");
	}, []);

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
			setError(response?.error ?? "Save failed");
			setStatus("error");
			return;
		}
		setData({ ...data, settings: { ...data.settings, threshold } });
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
				setError(response?.error ?? "Could not capture preview");
				setStatus("error");
				return;
			}
			setCapturePreview(response.data.croppedDataUrl);
			setStatus("idle");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Could not capture preview";
			setError(message);
			setStatus("error");
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

			<p className="subtitle">
				{auth.isAuthenticated
					? `${auth.username ?? "GitHub"} · ${auth.method ?? "?"}`
					: "Not signed in"}
			</p>

			{error ? <p className="error">{error}</p> : null}

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
						<h2 className="card-heading">Capture</h2>
						<label className="field-label" htmlFor="thr">
							Match threshold (%)
						</label>
						<input
							id="thr"
							className="field-input"
							type="number"
							min={0}
							max={100}
							value={settings.threshold}
							disabled={status === "saving"}
							onChange={(e) => {
								const t = Number(e.target.value);
								if (Number.isFinite(t)) {
									void saveThreshold(t);
								}
							}}
						/>
						<button
							type="button"
							className="btn-full"
							onClick={() => void handleCapture()}
							disabled={status === "capturing"}
						>
							{status === "capturing" ? "Capturing…" : "Capture preview"}
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
