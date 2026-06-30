/** Syntax colors from the CSSBattle CodeMirror theme (cssbattle.dev). */
export const CSSBATTLE_EDITOR_COLORS = {
	background: "#2a2734",
	foreground: "#6c6783",
	tag: "#eeebff",
	number: "#ffcc99",
	selector: "#ffad5c",
	function: "#ffb870",
	property: "#9a86fd",
	operator: "#e09142",
} as const;

const cssbattleHighlightTokenStyles = `
.csshub-formatting-preview-code .hljs-tag {
	color: ${CSSBATTLE_EDITOR_COLORS.foreground};
}
.csshub-formatting-preview-code .hljs-name {
	color: ${CSSBATTLE_EDITOR_COLORS.tag};
}
.csshub-formatting-preview-code .hljs-attr,
.csshub-formatting-preview-code .hljs-attribute,
.csshub-formatting-preview-code .hljs-property {
	color: ${CSSBATTLE_EDITOR_COLORS.property};
}
.csshub-formatting-preview-code .hljs-string {
	color: ${CSSBATTLE_EDITOR_COLORS.foreground};
}
.csshub-formatting-preview-code .hljs-number {
	color: ${CSSBATTLE_EDITOR_COLORS.number};
}
.csshub-formatting-preview-code .hljs-hex {
	color: ${CSSBATTLE_EDITOR_COLORS.foreground};
}
.csshub-formatting-preview-code .hljs-comment,
.csshub-formatting-preview-code .hljs-meta {
	color: ${CSSBATTLE_EDITOR_COLORS.foreground};
	font-style: italic;
}
.csshub-formatting-preview-code .hljs-selector-class,
.csshub-formatting-preview-code .hljs-selector-id,
.csshub-formatting-preview-code .hljs-selector-tag,
.csshub-formatting-preview-code .hljs-selector-pseudo,
.csshub-formatting-preview-code .hljs-selector-attr {
	color: ${CSSBATTLE_EDITOR_COLORS.selector};
}
.csshub-formatting-preview-code .hljs-built_in,
.csshub-formatting-preview-code .hljs-keyword {
	color: ${CSSBATTLE_EDITOR_COLORS.function};
}
.csshub-formatting-preview-code .hljs-value {
	color: ${CSSBATTLE_EDITOR_COLORS.number};
}
.csshub-formatting-preview-code .hljs-punctuation {
	color: ${CSSBATTLE_EDITOR_COLORS.operator};
}
.csshub-formatting-preview-code .hljs-csb-selector {
	color: ${CSSBATTLE_EDITOR_COLORS.selector};
}
.csshub-formatting-preview-code .hljs-csb-operator {
	color: ${CSSBATTLE_EDITOR_COLORS.operator};
}
.csshub-formatting-preview-code .hljs-csb-value {
	color: ${CSSBATTLE_EDITOR_COLORS.number};
}
.csshub-formatting-preview-code .hljs-subst,
.csshub-formatting-preview-code .hljs-symbol,
.csshub-formatting-preview-code .hljs-literal {
	color: ${CSSBATTLE_EDITOR_COLORS.foreground};
}
`;

/** Isolated preview styles for a shadow root (immune to CSSBattle page CSS). */
export const formatPreviewShadowStyles = `
:host {
	position: fixed;
	inset: 0;
	z-index: 2147483646;
}
.csshub-formatting-preview-overlay {
	position: fixed;
	inset: 0;
	display: grid;
	place-items: center;
	padding: 24px;
	background: rgba(0, 0, 0, 0.55);
}
.csshub-formatting-preview-panel {
	width: min(760px, 100%);
	max-height: min(70vh, 640px);
	display: flex;
	flex-direction: column;
	border-radius: 14px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	background: ${CSSBATTLE_EDITOR_COLORS.background};
	box-shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
	overflow: hidden;
}
.csshub-formatting-preview-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 14px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.csshub-formatting-preview-title {
	margin: 0;
	font: 600 13px/1.3 system-ui, sans-serif;
	color: #fafaf9;
}
.csshub-formatting-preview-actions {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-shrink: 0;
}
.csshub-formatting-preview-apply,
.csshub-formatting-preview-close {
	border: 1px solid rgba(255, 255, 255, 0.14);
	border-radius: 8px;
	background: rgba(41, 37, 36, 0.98);
	color: #fafaf9;
	padding: 6px 10px;
	font: 600 12px/1.25 system-ui, sans-serif;
	cursor: pointer;
}
.csshub-formatting-preview-apply {
	background: linear-gradient(135deg, #ea580c, #c2410c);
	border-color: rgba(249, 115, 22, 0.5);
	color: #fff7ed;
}
.csshub-formatting-preview-apply:hover {
	background: linear-gradient(
		135deg,
		color-mix(in srgb, #ea580c 88%, white),
		color-mix(in srgb, #c2410c 85%, white)
	);
	border-color: rgba(251, 146, 60, 0.58);
}
.csshub-formatting-preview-close:hover {
	background: rgba(51, 47, 46, 0.98);
}
.csshub-formatting-preview-code {
	margin: 0;
	padding: 14px;
	overflow: auto;
	white-space: pre-wrap;
	word-break: break-word;
	font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	color: ${CSSBATTLE_EDITOR_COLORS.foreground};
}
.csshub-formatting-preview-code code {
	display: block;
	font: inherit;
}
${cssbattleHighlightTokenStyles}
`;
