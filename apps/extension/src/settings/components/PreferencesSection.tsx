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
		<div className="toggle-row">
			<div>
				<p className="toggle-title">Browser/system notifications</p>
				<p className="muted">
					Show desktop notifications from the extension. In-app badges and activity
					log remain active.
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
