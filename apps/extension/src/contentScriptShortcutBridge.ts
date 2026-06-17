const CSSHUB_SUBMIT_SHORTCUT_MESSAGE_TYPE = "CSSHUB_SUBMIT_SHORTCUT";
const CSSHUB_MESSAGE_SOURCE = "csshub-shortcut-bridge";

const isCssBattleSubmitShortcut = (event: KeyboardEvent): boolean =>
	(event.key === "Enter" || event.code === "Enter" || event.code === "NumpadEnter") &&
	(event.metaKey || event.ctrlKey) &&
	!event.altKey &&
	!event.shiftKey &&
	!event.repeat;

const postSubmitShortcut = (event: KeyboardEvent): void => {
	if (!isCssBattleSubmitShortcut(event)) {
		return;
	}

	window.postMessage(
		{
			source: CSSHUB_MESSAGE_SOURCE,
			type: CSSHUB_SUBMIT_SHORTCUT_MESSAGE_TYPE,
			keyEventType: event.type,
		},
		window.location.origin
	);
};

window.addEventListener("keydown", postSubmitShortcut, true);
window.addEventListener("keyup", postSubmitShortcut, true);
