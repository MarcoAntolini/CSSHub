import type { ReactElement } from "react";
import type { ExtensionSettings } from "../../shared/contracts";

type PreferencesSectionProps = {
	settings: ExtensionSettings;
	busy: boolean;
	onToggleSystemNotifications: (enabled: boolean) => void;
};

export const PreferencesSection = ({
	settings,
	busy,
	onToggleSystemNotifications,
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
	</section>
);
