import type { ExtensionTheme } from "@/shared/extensionTheme";
import { ThemeToggle } from "@/shared/ThemeToggle";
import type { ReactElement } from "react";
import {
	SETTINGS_HERO_TAGLINE,
	SETTINGS_PAGE_ICON_SRC,
} from "@/settings/constants";

type SettingsHeroProps = {
	theme: ExtensionTheme;
	onToggleTheme: () => void;
};

export const SettingsHero = ({
	theme,
	onToggleTheme,
}: SettingsHeroProps): ReactElement => (
	<header className="settings-hero">
		<img
			className="settings-page-icon"
			src={SETTINGS_PAGE_ICON_SRC}
			width={112}
			height={112}
			alt=""
			decoding="async"
		/>
		<div className="settings-hero-copy">
			<h1 className="settings-brand">CssHub</h1>
			<p className="settings-tagline">{SETTINGS_HERO_TAGLINE}</p>
		</div>
		<div className="settings-hero-actions">
			<ThemeToggle theme={theme} onToggle={onToggleTheme} />
		</div>
	</header>
);
