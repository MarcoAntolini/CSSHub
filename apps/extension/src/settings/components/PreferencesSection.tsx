import type { ReactElement } from "react";
import type { ExtensionSettings, PageFeedbackPlacement } from "@/shared/contracts";

const PAGE_FEEDBACK_PLACEMENTS: readonly {
	value: PageFeedbackPlacement;
	label: string;
}[] = [
	{ value: "top-left", label: "Top left" },
	{ value: "top-right", label: "Top right" },
	{ value: "bottom-left", label: "Bottom left" },
	{ value: "bottom-right", label: "Bottom right" },
];

const isPageFeedbackPlacement = (value: string): value is PageFeedbackPlacement =>
	PAGE_FEEDBACK_PLACEMENTS.some((option) => option.value === value);

type PreferencesSectionProps = {
	settings: ExtensionSettings;
	busy: boolean;
	onToggleSystemNotifications: (enabled: boolean) => void;
	onSaveSettings: (settings: ExtensionSettings) => void;
};

export const PreferencesSection = ({
	settings,
	busy,
	onToggleSystemNotifications,
	onSaveSettings,
}: PreferencesSectionProps): ReactElement => (
	<section className="settings-section">
		<h2>Notifications</h2>
		<p className="muted preferences-lead">
			Toolbar badges and the activity log always reflect sync outcomes. Desktop
			alerts are optional.
		</p>
		<div className="toggle-row">
			<div className="toggle-copy">
				<p className="toggle-title">Desktop notifications</p>
				<p className="toggle-caption">
					Show system alerts when CssHub syncs, skips, or errors. Click to open
					the commit or these settings.
				</p>
			</div>
			<label className="switch" htmlFor="system-notifications-toggle">
				<input
					id="system-notifications-toggle"
					type="checkbox"
					checked={settings.systemNotificationsEnabled}
					disabled={busy}
					onChange={(e) => {
						onToggleSystemNotifications(e.target.checked);
					}}
				/>
				<span className="switch-slider" />
			</label>
		</div>
		<div className="page-feedback-field">
			<label className="toggle-title" htmlFor="page-feedback-placement">
				Page Feedback position
			</label>
			<p className="toggle-caption">
				Where CssHub shows submit outcomes on the CSSBattle tab.
			</p>
			<div className="row row-tight page-feedback-select-row">
				<select
					id="page-feedback-placement"
					value={settings.pageFeedbackPlacement ?? "bottom-right"}
					disabled={busy}
					onChange={(e) => {
						const value = e.target.value;
						if (isPageFeedbackPlacement(value)) {
							onSaveSettings({ ...settings, pageFeedbackPlacement: value });
						}
					}}
				>
					{PAGE_FEEDBACK_PLACEMENTS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
			<p className="hint">
				Bottom right automatically moves above CSSBattle&apos;s own feedback when
				both are visible.
			</p>
		</div>
	</section>
);
