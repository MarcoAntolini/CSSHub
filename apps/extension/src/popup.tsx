import { createRoot } from "react-dom/client";
import "../public/popup.css";
import {
	applyPopupTheme,
	DEFAULT_POPUP_THEME,
	loadPopupTheme,
} from "./popupTheme";
import { App } from "./popup/App";

applyPopupTheme(DEFAULT_POPUP_THEME);
void loadPopupTheme().then(applyPopupTheme);

const container = document.getElementById("root");
if (!container) {
	throw new Error("Popup root element not found");
}

createRoot(container).render(<App />);
