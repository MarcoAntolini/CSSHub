import type { ReactElement } from "react";
import { openSettingsPage } from "../openSettingsPage";

export const AuthPrompt = (): ReactElement => (
	<section className="card">
		<p className="card-help">Sign in and pick a repo in Settings.</p>
		<button type="button" className="btn-full" onClick={openSettingsPage}>
			Open Settings
		</button>
	</section>
);
