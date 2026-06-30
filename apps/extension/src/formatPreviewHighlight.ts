import hljs from "highlight.js/lib/core";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";

hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);

/** Minified CSSBattle code often omits the closing tag; match both forms. */
const STYLE_BLOCK_RE = /<style[^>]*>([\s\S]*?)(?:<\/style>|$)/gi;
const CSS_VALUE_KEYWORDS =
	/\b(no-repeat|repeat-x|repeat-y|repeat|scroll|fixed|local|solid|dashed|dotted|hidden|visible|auto|none|content-box|border-box|absolute|relative|static|sticky|center|left|right|top|bottom|cover|contain)\b/g;

const highlightHtmlFragment = (fragment: string): string => {
	if (!fragment) {
		return "";
	}
	return hljs.highlight(fragment, { language: "xml" }).value;
};

const HEX_COLOR_SPAN_RE =
	/<span class="(?:[^"]*\s)?hljs-number(?:\s[^"]*)?">(#[0-9a-fA-F]{3,8})<\/span>/g;

const reclassifyHexColorSpans = (highlighted: string): string =>
	highlighted.replace(HEX_COLOR_SPAN_RE, '<span class="hljs-hex">$1</span>');

const enhanceCssbattleCssTokens = (highlighted: string): string => {
	let html = highlighted;

	html = html.replace(
		/&amp;(\s*\{)/g,
		'<span class="hljs-csb-selector">&</span>$1'
	);
	html = html.replace(
		/([;{,])\*(\s*\{)/g,
		'$1<span class="hljs-csb-selector">*</span>$2'
	);
	html = html.replace(
		/(?<=[;{,\s])\*(\s*\{)/g,
		'<span class="hljs-csb-selector">*</span>$1'
	);

	html = html.replace(
		/(<span class="hljs-attribute">[^<]+<\/span>)(:)/g,
		'$1<span class="hljs-csb-operator">:</span>'
	);

	html = html.replace(
		/<span class="hljs-number">(\d+\.?\d*)(px|em|rem|vmin|vmax|vh|vw|ch|ex|cm|mm|in|pt|pc|%)(?!\d)<\/span>/g,
		'<span class="hljs-number">$1</span><span class="hljs-csb-operator">$2</span>'
	);

	html = html.replace(/(?<![\w-]);/g, '<span class="hljs-csb-operator">;</span>');
	html = html.replace(/,(?=[#&*\w(<])/g, '<span class="hljs-csb-operator">,</span>');
	html = html.replace(/(\s)\/(\s)/g, '$1<span class="hljs-csb-operator">/</span>$2');
	html = html.replace(
		/(<\/span>)\/(<span class="hljs-number">)/g,
		'$1<span class="hljs-csb-operator">/</span>$2'
	);
	html = html.replace(
		/(<span class="hljs-number">\d+\.?\d*<\/span>)\s*-(<span class="hljs-number">)/g,
		'$1<span class="hljs-csb-operator">-</span>$2'
	);

	html = html.replace(CSS_VALUE_KEYWORDS, '<span class="hljs-csb-value">$1</span>');

	return reclassifyHexColorSpans(html);
};

const highlightCssFragment = (cssCode: string): string =>
	enhanceCssbattleCssTokens(hljs.highlight(cssCode, { language: "css" }).value);

const highlightHtmlWithStyleBlocks = (code: string): string => {
	const parts: string[] = [];
	let lastIndex = 0;

	for (const match of code.matchAll(STYLE_BLOCK_RE)) {
		const matchIndex = match.index ?? 0;
		parts.push(highlightHtmlFragment(code.slice(lastIndex, matchIndex)));

		const fullMatch = match[0];
		const cssStart = fullMatch.indexOf(">") + 1;
		const closeTagIndex = fullMatch.lastIndexOf("</");
		const hasCloseTag = closeTagIndex > cssStart;
		const cssEnd = hasCloseTag ? closeTagIndex : fullMatch.length;
		const openTag = fullMatch.slice(0, cssStart);
		const cssBody = fullMatch.slice(cssStart, cssEnd);
		const closeTag = hasCloseTag ? fullMatch.slice(cssEnd) : "";

		parts.push(highlightHtmlFragment(openTag));
		parts.push(highlightCssFragment(cssBody));
		parts.push(highlightHtmlFragment(closeTag));

		lastIndex = matchIndex + fullMatch.length;
	}

	parts.push(highlightHtmlFragment(code.slice(lastIndex)));
	return parts.join("");
};

export const highlightFormatPreviewCode = (code: string): string => {
	if (code.trimStart().startsWith("<") && /<style[\s>]/i.test(code)) {
		return highlightHtmlWithStyleBlocks(code);
	}
	if (code.trimStart().startsWith("<")) {
		return hljs.highlight(code, { language: "xml" }).value;
	}
	return highlightCssFragment(code);
};
