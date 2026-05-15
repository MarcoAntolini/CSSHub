import type { ReactElement } from "react";
import {
	SETTINGS_HERO_TAGLINE,
	SETTINGS_PAGE_ICON_SRC,
} from "../constants";

export const SettingsHero = (): ReactElement => (
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
	</header>
);
