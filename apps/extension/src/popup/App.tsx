import type { ReactElement } from "react";
import { AuthPrompt } from "./AuthPrompt";
import { SHOW_STATUS_DEMO } from "./constants";
import { LastSubmissionSection } from "./LastSubmissionSection";
import { PopupHeader } from "./PopupHeader";
import { SubmissionCard } from "./SubmissionCard";
import { SubmissionFlowSection } from "./SubmissionFlowSection";
import { STATUS_DEMO_CASES } from "./statusDemoCases";
import { usePopupTheme } from "./ThemeToggle";
import { usePopupState } from "./usePopupState";
import { clampThreshold } from "./utils";

export const App = (): ReactElement => {
	const { theme, toggleTheme } = usePopupTheme();
	const {
		data,
		loading,
		status,
		errorMessage,
		thresholdDraft,
		setThresholdDraft,
	} = usePopupState();

	if (loading || !data) {
		return (
			<main className="popup popup-shell">
				<PopupHeader
					theme={theme}
					onToggleTheme={toggleTheme}
					showSettingsLink={false}
				/>
				<p className="subtitle">
					{loading ? "Loading…" : (errorMessage ?? "Something went wrong.")}
				</p>
			</main>
		);
	}

	const { auth, settings, lastSubmission, lastIngestion } = data;

	return (
		<main className="popup popup-shell">
			{errorMessage ? (
				<p className="popup-inline-error" role="alert">
					{errorMessage}
				</p>
			) : null}
			<PopupHeader
				theme={theme}
				onToggleTheme={toggleTheme}
				showSettingsLink={auth.isAuthenticated}
			/>

			{!auth.isAuthenticated ? (
				<AuthPrompt />
			) : (
				<>
					<SubmissionFlowSection
						settings={settings}
						thresholdDraft={thresholdDraft}
						status={status}
						onThresholdChange={(value) =>
							setThresholdDraft(clampThreshold(value))
						}
					/>
					<LastSubmissionSection
						lastSubmission={lastSubmission}
						lastIngestion={lastIngestion}
					/>
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
	);
};
