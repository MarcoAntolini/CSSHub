import type { ReactElement } from "react";
import type { ExtensionSettings, SavedCodeFormat } from "@/shared/contracts";

const SAVED_CODE_FORMATS: readonly { value: SavedCodeFormat; label: string }[] = [
	{ value: "original", label: "Original" },
	{ value: "prettified", label: "Prettified" },
	{ value: "minified", label: "Minified" },
];

const isSavedCodeFormat = (value: string): value is SavedCodeFormat =>
	SAVED_CODE_FORMATS.some((option) => option.value === value);

type CodeFormattingSectionProps = {
	settings: ExtensionSettings;
	busy: boolean;
	onSaveSettings: (settings: ExtensionSettings) => void;
};

export const CodeFormattingSection = ({
	settings,
	busy,
	onSaveSettings,
}: CodeFormattingSectionProps): ReactElement => {
	const primaryFormat = settings.savedCodeFormat ?? "original";
	const prettifiedPrimary = primaryFormat === "prettified";

	return (
		<div className="code-formatting-section">
			<div className="code-formatting-intro">
				<p className="code-formatting-intro-lead">
					When you sync, CssHub saves your solution to that Target&apos;s README in
					your repo.
				</p>
				<ul className="code-formatting-intro-points">
					<li>
						<span className="code-formatting-intro-label">In your README</span>
						<span>
							Choose how the code block is formatted in that file when sync runs.
						</span>
					</li>
					<li>
						<span className="code-formatting-intro-label">On CSSBattle</span>
						<span>
							Optional Prettify and Minify buttons in the editor before you submit.
							They do not change the README format settings below.
						</span>
					</li>
				</ul>
			</div>

			<div className="code-formatting-group">
				<p className="code-formatting-group-title">In your README</p>
				<div className="settings-field-block">
					<label className="toggle-title" htmlFor="saved-code-format">
						Primary code block
					</label>
					<p className="toggle-caption">
						Written under the <strong>Code</strong> heading in each Target README
						when a submission syncs.
					</p>
					<div className="row row-tight code-formatting-select-row">
						<select
							id="saved-code-format"
							value={primaryFormat}
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
					<p className="hint code-formatting-format-hint">
						<strong>Original</strong> keeps the code as captured from CSSBattle.{" "}
						<strong>Prettified</strong> runs it through a formatter.{" "}
						<strong>Minified</strong> strips whitespace for a shorter block.
					</p>
				</div>
				<div className="code-formatting-toggles">
					<div className="toggle-row">
						<div className="toggle-copy">
							<p className="toggle-title">Also save a prettified copy</p>
							<p className="toggle-caption">
								Adds a second <strong>Prettified code</strong> section below{" "}
								<strong>Code</strong> so you keep the raw submission and a
								formatted version side by side.
							</p>
							{prettifiedPrimary ? (
								<p className="hint code-formatting-toggle-hint">
									Unavailable while the primary format is Prettified — the main
									block already is.
								</p>
							) : null}
						</div>
						<label className="switch" htmlFor="include-prettified-code-toggle">
							<input
								id="include-prettified-code-toggle"
								type="checkbox"
								checked={settings.includePrettifiedCode ?? false}
								disabled={busy || prettifiedPrimary}
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
				</div>
			</div>

			<div className="code-formatting-group">
				<p className="code-formatting-group-title">On CSSBattle</p>
				<div className="code-formatting-toggles">
					<div className="toggle-row">
						<div className="toggle-copy">
							<p className="toggle-title">Formatting controls in the editor</p>
							<p className="toggle-caption">
								Shows Prettify and Minify buttons near the solution editor. Use
								them to preview or rewrite your code on the page before you hit
								Submit.
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
				</div>
			</div>
		</div>
	);
};
