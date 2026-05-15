import { createRoot } from "react-dom/client";
import "sonner/dist/styles.css";
import "../public/settings.css";
import { SettingsApp } from "./settings/SettingsApp";

const container = document.getElementById("root");
if (!container) {
	throw new Error("Settings root missing");
}

createRoot(container).render(<SettingsApp />);
