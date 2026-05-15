import type { ReactElement } from "react";
import { SettingsHero } from "./SettingsHero";

export const LoadingShell = (): ReactElement => (
	<main
		className="settings-root settings-loading-shell"
		aria-busy="true"
		aria-live="polite"
	>
		<SettingsHero />
		<div
			className="settings-section loading-shell-card"
			role="status"
			aria-label="Loading settings"
		>
			<div className="loading-shell-line loading-shell-line-lg" />
			<div className="loading-shell-line" />
			<div className="loading-shell-line loading-shell-line-sm" />
		</div>
	</main>
);
