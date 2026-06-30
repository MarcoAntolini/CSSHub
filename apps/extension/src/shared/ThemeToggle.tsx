import { useCallback, useEffect, useState, type ReactElement, type SVGProps } from "react";
import {
	applyExtensionTheme,
	DEFAULT_EXTENSION_THEME,
	EXTENSION_THEME_STORAGE_KEY,
	loadExtensionTheme,
	saveExtensionTheme,
	type ExtensionTheme,
} from "@/shared/extensionTheme";

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

export const useExtensionTheme = (): {
	theme: ExtensionTheme;
	toggleTheme: () => void;
} => {
	const [theme, setTheme] = useState<ExtensionTheme>(DEFAULT_EXTENSION_THEME);

	useEffect(() => {
		let cancelled = false;
		void loadExtensionTheme().then((stored) => {
			if (cancelled) {
				return;
			}
			setTheme(stored);
			applyExtensionTheme(stored);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const onChanged = (
			changes: Record<string, chrome.storage.StorageChange>,
			areaName: string
		): void => {
			if (areaName !== "local" || !changes[EXTENSION_THEME_STORAGE_KEY]) {
				return;
			}
			const next = changes[EXTENSION_THEME_STORAGE_KEY].newValue;
			if (next === "light" || next === "dark") {
				setTheme(next);
				applyExtensionTheme(next);
			}
		};
		chrome.storage.onChanged.addListener(onChanged);
		return () => {
			chrome.storage.onChanged.removeListener(onChanged);
		};
	}, []);

	const toggleTheme = useCallback((): void => {
		setTheme((current) => {
			const next: ExtensionTheme = current === "dark" ? "light" : "dark";
			applyExtensionTheme(next);
			void saveExtensionTheme(next);
			return next;
		});
	}, []);

	return { theme, toggleTheme };
};

type ThemeToggleProps = {
	theme: ExtensionTheme;
	onToggle: () => void;
	className?: string;
};

export const ThemeToggle = ({
	theme,
	onToggle,
	className = "theme-toggle",
}: ThemeToggleProps): ReactElement => {
	const isDark = theme === "dark";
	return (
		<button
			type="button"
			className={className}
			onClick={onToggle}
			aria-pressed={isDark}
			aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
			title={isDark ? "Switch to light mode" : "Switch to dark mode"}
		>
			{isDark ? <SunIcon /> : <MoonIcon />}
		</button>
	);
};

/** @deprecated Use useExtensionTheme */
export const usePopupTheme = useExtensionTheme;
