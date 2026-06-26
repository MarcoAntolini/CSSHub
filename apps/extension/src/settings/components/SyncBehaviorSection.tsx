import { useState, type ReactElement } from "react";

export const SyncBehaviorSection = (): ReactElement => {
	const [syncInfoOpen, setSyncInfoOpen] = useState(false);

	return (
		<section className="settings-section">
			<div className="section-headline">
				<div className="section-title-row">
					<h2>How sync works</h2>
					<button
						type="button"
						className="help-badge"
						aria-expanded={syncInfoOpen}
						aria-controls="sync-behavior-info-panel"
						onClick={() => setSyncInfoOpen((open) => !open)}
						title="Background sync details"
					>
						?
					</button>
				</div>
			</div>
			<p className="muted preferences-lead">
				Sync runs in the extension background. CssHub never navigates the tab you
				are playing in.
			</p>
			<p className="muted compatibility-note">
				CssHub reads the CSSBattle page to detect Target details, Score, Solution
				code, and preview images. Extensions or styles that hide or modify page
				sections may cause capture to fail or Sync to skip. If something looks
				wrong, disable page-modifying extensions for CSSBattle and submit again.
			</p>
			{syncInfoOpen ? (
				<div
					className="readme-info-panel"
					id="sync-behavior-info-panel"
					role="region"
					aria-label="Background sync details"
				>
					<p>
						Most work happens in the extension&apos;s background service — GitHub
						API calls, image fetches, and commit creation.
					</p>
					<p>
						When updating battle progress in your repository README, CssHub may
						briefly open a <strong>background CSSBattle tab</strong>, read the
						page, then close it automatically. Your current tab stays active.
					</p>
					<p>You do not need to do anything when this happens.</p>
				</div>
			) : null}
		</section>
	);
};
