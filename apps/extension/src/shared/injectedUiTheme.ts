import type { ExtensionTheme } from "./extensionTheme";

export type InjectedUiColors = {
	text: string;
	muted: string;
	subtle: string;
	border: string;
	surface: string;
	surfaceStrong: string;
	label: string;
	primaryText: string;
	primaryBg: string;
	primaryBorder: string;
	primaryHoverBg: string;
	buttonBg: string;
	buttonBorder: string;
	buttonHoverBg: string;
	focusRing: string;
	overlayBg: string;
	panelShadow: string;
};

const INJECTED_UI_DARK: InjectedUiColors = {
	text: "#e2e8f0",
	muted: "#94a3b8",
	subtle: "#64748b",
	border: "rgba(148, 163, 184, 0.15)",
	surface: "rgba(15, 23, 42, 0.94)",
	surfaceStrong: "rgba(30, 41, 59, 0.98)",
	label: "#94a3b8",
	primaryText: "#fff7ed",
	primaryBg: "linear-gradient(135deg, #ea580c, #c2410c)",
	primaryBorder: "rgba(249, 115, 22, 0.5)",
	primaryHoverBg:
		"linear-gradient(135deg, color-mix(in srgb, #ea580c 88%, white), color-mix(in srgb, #c2410c 85%, white))",
	buttonBg: "rgba(30, 41, 59, 0.55)",
	buttonBorder: "rgba(148, 163, 184, 0.28)",
	buttonHoverBg: "rgba(30, 41, 59, 0.85)",
	focusRing: "rgba(249, 115, 22, 0.85)",
	overlayBg: "rgba(2, 6, 23, 0.72)",
	panelShadow: "0 12px 32px rgba(0, 0, 0, 0.35)",
};

const INJECTED_UI_LIGHT: InjectedUiColors = {
	text: "#0f172a",
	muted: "#475569",
	subtle: "#64748b",
	border: "#e2e8f0",
	surface: "rgba(255, 255, 255, 0.96)",
	surfaceStrong: "#ffffff",
	label: "#64748b",
	primaryText: "#fff7ed",
	primaryBg: "linear-gradient(135deg, #ea580c, #c2410c)",
	primaryBorder: "rgba(234, 88, 12, 0.45)",
	primaryHoverBg:
		"linear-gradient(135deg, color-mix(in srgb, #ea580c 92%, white), color-mix(in srgb, #c2410c 88%, white))",
	buttonBg: "#f8fafc",
	buttonBorder: "#cbd5e1",
	buttonHoverBg: "#f1f5f9",
	focusRing: "rgba(234, 88, 12, 0.75)",
	overlayBg: "rgba(15, 23, 42, 0.35)",
	panelShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
};

export const injectedUiColorsForTheme = (theme: ExtensionTheme): InjectedUiColors =>
	theme === "light" ? INJECTED_UI_LIGHT : INJECTED_UI_DARK;
