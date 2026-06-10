import type { ReactElement } from "react";
import type { PopupTheme } from "@/popupTheme";
import { openSettingsPage } from "@/openSettingsPage";
import { ThemeToggle } from "./ThemeToggle";

export const PopupHeader = ({
	theme,
	onToggleTheme,
	showSettingsLink,
}: {
	theme: PopupTheme;
	onToggleTheme: () => void;
	showSettingsLink: boolean;
}): ReactElement => (
	<header className="popup-header">
		<h1 className="popup-title">CssHub</h1>
		<div className="popup-header-actions">
			<ThemeToggle theme={theme} onToggle={onToggleTheme} />
			{showSettingsLink ? (
				<button type="button" className="btn-link" onClick={openSettingsPage}>
					Settings
				</button>
			) : null}
		</div>
	</header>
);
