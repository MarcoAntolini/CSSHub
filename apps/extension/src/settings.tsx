import { createRoot } from "react-dom/client";
import "sonner/dist/styles.css";
import "../public/settings.css";
import {
	applyExtensionTheme,
	DEFAULT_EXTENSION_THEME,
	loadExtensionTheme,
} from "./shared/extensionTheme";
import { SettingsApp } from "./settings/SettingsApp";

applyExtensionTheme(DEFAULT_EXTENSION_THEME);
void loadExtensionTheme().then(applyExtensionTheme);

const container = document.getElementById("root");
if (!container) {
	throw new Error("Settings root missing");
}

createRoot(container).render(<SettingsApp />);
