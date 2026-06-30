import type { ReactElement } from "react";
import type { ExtensionSettings, PageFeedbackPlacement, SavedCodeFormat } from "@/shared/contracts";

const PAGE_FEEDBACK_PLACEMENTS: readonly {
	value: PageFeedbackPlacement;
	label: string;
}[] = [
	{ value: "top-left", label: "Top left" },
	{ value: "top-right", label: "Top right" },
	{ value: "bottom-left", label: "Bottom left" },
	{ value: "bottom-right", label: "Bottom right" },
];

const SAVED_CODE_FORMATS: readonly { value: SavedCodeFormat; label: string }[] = [
	{ value: "original", label: "Original" },
	{ value: "prettified", label: "Prettified" },
	{ value: "minified", label: "Minified" },
];

const isPageFeedbackPlacement = (value: string): value is PageFeedbackPlacement =>
	PAGE_FEEDBACK_PLACEMENTS.some((option) => option.value === value);

const isSavedCodeFormat = (value: string): value is SavedCodeFormat =>
	SAVED_CODE_FORMATS.some((option) => option.value === value);

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

		<h2>Saved code format</h2>
		<p className="muted preferences-lead">
			Controls how CssHub writes Solution code into each Target README when a
			Submission commits. Page controls let you preview or apply formatting in
			the CSSBattle editor before you submit.
		</p>
		<div className="page-feedback-field">
			<label className="toggle-title" htmlFor="saved-code-format">
				Saved code format
			</label>
			<p className="toggle-caption">
				Primary code block in the Battle Archive README for each committed
				Submission.
			</p>
			<div className="row row-tight page-feedback-select-row">
				<select
					id="saved-code-format"
					value={settings.savedCodeFormat ?? "original"}
					disabled={busy}
					onChange={(e) => {
						const value = e.target.value;
						if (isSavedCodeFormat(value)) {
							onSaveSettings({ ...settings, savedCodeFormat: value });
						}
					}}
				>
					{SAVED_CODE_FORMATS.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
		</div>
		<div className="toggle-row">
			<div className="toggle-copy">
				<p className="toggle-title">Also include prettified code</p>
				<p className="toggle-caption">
					Add a separate Prettified code section below Code unless the primary
					format is already Prettified.
				</p>
			</div>
			<label className="switch" htmlFor="include-prettified-code-toggle">
				<input
					id="include-prettified-code-toggle"
					type="checkbox"
					checked={settings.includePrettifiedCode ?? false}
					disabled={busy || settings.savedCodeFormat === "prettified"}
					onChange={(e) => {
						onSaveSettings({
							...settings,
							includePrettifiedCode: e.target.checked,
						});
					}}
				/>
				<span className="switch-slider" />
			</label>
		</div>
		<div className="toggle-row">
			<div className="toggle-copy">
				<p className="toggle-title">Show formatting controls on CSSBattle</p>
				<p className="toggle-caption">
					Inject preview and apply buttons near the CSSBattle editor.
				</p>
			</div>
			<label className="switch" htmlFor="show-formatting-controls-toggle">
				<input
					id="show-formatting-controls-toggle"
					type="checkbox"
					checked={settings.showFormattingControls ?? true}
					disabled={busy}
					onChange={(e) => {
						onSaveSettings({
							...settings,
							showFormattingControls: e.target.checked,
						});
					}}
				/>
				<span className="switch-slider" />
			</label>
		</div>
	</section>
);
