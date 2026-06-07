import type { ReactElement, SVGProps } from "react";
import { useCallback, useEffect, useState } from "react";
import {
	applyPopupTheme,
	DEFAULT_POPUP_THEME,
	loadPopupTheme,
	savePopupTheme,
	type PopupTheme,
} from "../popupTheme";

const SunIcon = (props: SVGProps<SVGSVGElement>): ReactElement => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		aria-hidden="true"
		{...props}
	>
		<circle cx="12" cy="12" r="4" />
		<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
	</svg>
);

const MoonIcon = (props: SVGProps<SVGSVGElement>): ReactElement => (
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth="2"
		aria-hidden="true"
		{...props}
	>
		<path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
	</svg>
);

export const usePopupTheme = (): {
	theme: PopupTheme;
	toggleTheme: () => void;
} => {
	const [theme, setTheme] = useState<PopupTheme>(DEFAULT_POPUP_THEME);

	useEffect(() => {
		let cancelled = false;
		void loadPopupTheme().then((stored) => {
			if (cancelled) {
				return;
			}
			setTheme(stored);
			applyPopupTheme(stored);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const toggleTheme = useCallback((): void => {
		setTheme((current) => {
			const next: PopupTheme = current === "dark" ? "light" : "dark";
			applyPopupTheme(next);
			void savePopupTheme(next);
			return next;
		});
	}, []);

	return { theme, toggleTheme };
};

export const ThemeToggle = ({
	theme,
	onToggle,
}: {
	theme: PopupTheme;
	onToggle: () => void;
}): ReactElement => {
	const isDark = theme === "dark";
	return (
		<button
			type="button"
			className="theme-toggle"
			onClick={onToggle}
			aria-pressed={isDark}
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			title={isDark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{isDark ? <SunIcon /> : <MoonIcon />}
		</button>
	);
};
