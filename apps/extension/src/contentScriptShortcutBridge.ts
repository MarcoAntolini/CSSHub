const CSSHUB_SUBMIT_SHORTCUT_MESSAGE_TYPE = "CSSHUB_SUBMIT_SHORTCUT";
const CSSHUB_MESSAGE_SOURCE = "csshub-shortcut-bridge";
const ENTER_SHORTCUT_VALUES = new Set(["Enter", "NumpadEnter"]);

const isCssBattleSubmitShortcut = (event: KeyboardEvent): boolean =>
	[
		[event.key, event.code].some((value) => ENTER_SHORTCUT_VALUES.has(value)),
		[event.metaKey, event.ctrlKey].some(Boolean),
		![event.altKey, event.shiftKey, event.repeat].some(Boolean),
	].every(Boolean);

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
