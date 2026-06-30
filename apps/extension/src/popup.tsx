import { createRoot } from "react-dom/client";
import "../public/popup.css";
import {
	applyExtensionTheme,
	DEFAULT_EXTENSION_THEME,
	loadExtensionTheme,
} from "./shared/extensionTheme";
import { App } from "./popup/App";

applyExtensionTheme(DEFAULT_EXTENSION_THEME);
void loadExtensionTheme().then(applyExtensionTheme);

const container = document.getElementById("root");
if (!container) {
	throw new Error("Popup root element not found");
}

createRoot(container).render(<App />);
