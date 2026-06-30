import type { EditorCodeFormat, ExtensionSettings } from "@/shared/contracts";
import * as prettier from "prettier";
import * as prettierPluginPostcss from "prettier/plugins/postcss";

const NBSP = "\u00a0";

export const minifySubmissionCode = (code: string): string =>
	code
		.replaceAll(NBSP, NBSP)
		.trim()
		.replaceAll(/<!--[\s\S]*?-->/g, "")
		.replaceAll(/transparent/g, "#0000")
		.replaceAll(/\s+/g, " ")
		.replaceAll(/\s0\s+0\./g, " .0.")
		.replaceAll(/(\s)0+\./g, "$1.")
		.replaceAll(/\s*#/g, "#")
		.replaceAll(/:\s*/g, ":")
		.replaceAll(/,\s*/g, ",")
		.replaceAll(/\s*;\s*/g, ";")
		.replaceAll(/%\s*/g, "%")
		.replaceAll(/%-\s/g, "% - ")
		.replaceAll(/\(\s*/g, "(")
		.replaceAll(/\s*\)\s*/g, ")")
		.replaceAll(/>\s*/g, ">")
		.replaceAll(/\s*\/\s*/g, "/")
		.replaceAll(/\s+(\d)/g, " $1")
		.replaceAll(/\s*\{\s*/g, "{")
		.replaceAll(/\s+\*\s+/g, " * ")
		.replaceAll(/\s+-/g, " -")
		.replaceAll(/(\d) -/g, "$1-")
		.replaceAll(/\s*([{}:;,])\s*/g, "$1")
		.replaceAll(/\.(\d*)([1-9])0+(\D)/g, ".$1$2$3")
		.replaceAll(/\+\s+(\S)/g, "+$1")
		.replaceAll(/(\S)\s+\+/g, "$1+")
		.replaceAll(/>\s*\*/g, ">*")
		.replaceAll(/\*\s*>/g, "*>")
		.replaceAll(/&\s*>/g, "&>")
		.replaceAll(/\}\s*/g, "}")
		.replaceAll(/;\s*\}/g, "}")
		.replace(/;?(\s*})*(<\/style>)?$/, "")
		.replaceAll(/\)*$/g, "")
		.replaceAll(/""$/g, '"')
		.replaceAll(/''$/g, "'")
		.replaceAll(/\s*"$/g, '"')
		.replaceAll(/\s*'$/g, "'")
		.replaceAll(/([a-zA-Z])\s+""/g, '$1""')
		.replaceAll(/([a-zA-Z])\s+''/g, "$1''")
		.replaceAll(/\.(\d+)\s+\.(\d)/g, ".$1.$2")
		.replaceAll(/(\d+)([a-zA-Z]+)\s+\.(\d)/g, "$1$2.$3")
		.replaceAll(/(#[a-fA-F0-9]{6})\s+\.(\d)/g, "$1.$2")
		.replaceAll(/(#[a-fA-F0-9]{4})\s+\.(\d)/g, "$1.$2")
		.replaceAll(/(#[a-fA-F0-9]{3})\s+\.(\d)/g, "$1.$2")
		.replaceAll(/([a-z]) (\.\d)/g, "$1$2")
		.replaceAll(NBSP, NBSP);

const closeBrackets =
	(open = "{", close = "}") =>
	(css: string): string => {
		let openedBraces = 0;
		let formattedCSS = "";
		for (let index = 0; index < css.length; index += 1) {
			const char = css[index];
			if (char === open) {
				openedBraces += 1;
				formattedCSS += open;
			} else if (char === close) {
				if (openedBraces > 0) {
					openedBraces -= 1;
					formattedCSS += close;
				}
			} else {
				formattedCSS += char;
			}
		}
		while (openedBraces > 0) {
			formattedCSS += close;
			openedBraces -= 1;
		}
		return formattedCSS;
	};

const prettifyCss = async (cssCode: string): Promise<string> =>
	prettier.format(cssCode, {
		parser: "css",
		plugins: [prettierPluginPostcss],
	});

const formatCss = async (css: string): Promise<string> => {
	let result = css.replace(/\s+/g, " ").trim();
	result = result.replaceAll(/([^'])'$/g, "$1 ''");
	result = result.replaceAll(/([^"]) "$/g, '$1 ""');
	result = closeBrackets("(", ")")(result);
	result = closeBrackets()(result);
	result = result.replace(/([^;}])(\s*})/g, "$1;$2");
	result = result.replaceAll(/(\S)#/g, "$1 #");
	result = result.replaceAll(/(\d)-/g, "$1 -");
	result = result.replaceAll(/\)-/g, ") -");
	result = result.replaceAll(/%(\S)/g, "% $1");
	result = result.replaceAll(/\/(\S)/g, "/ $1");
	result = result.replaceAll(/(\S)\//g, "$1 /");
	result = result.replaceAll(/(\.\d+)(\.\d+)/g, "$1 $2");
	result = result.replaceAll(/(\d+)([a-zA-Z]+)\.(\d)/g, "$1$2 .$3");
	result = await prettifyCss(result);
	result = result.replaceAll(/(#[0-9a-fA-F]{6})\./g, "$1 .");
	result = result.replaceAll(/(#[0-9a-fA-F]{4})\./g, "$1 .");
	result = result.replaceAll(/(#[0-9a-fA-F]{3})\./g, "$1 .");
	result = result.replaceAll(/\+(\s)+(\d)/g, "+$2");
	result = result.replaceAll(/#0000([^a-fA-F0-9])/g, "transparent$1");
	return result;
};

const formatHtmlWithCss = async (html: string): Promise<string> => {
	const styleRegex = /<style[^>]*>(.*?)(<\/style>)?$/i;
	const match = html.match(styleRegex);
	if (match) {
		const cssContent = await formatCss(await formatCss(match[1]));
		html = html.replace(styleRegex, `\n<style>\n${cssContent}\n</style>`);
	}
	return html.replace(/^\n/m, "");
};

export const prettifySubmissionCode = async (code: string): Promise<string> =>
	formatHtmlWithCss(code);

export type FormattedSubmissionCode = {
	primary: string;
	prettifiedExtra?: string;
};

export const formatSubmissionCode = async (
	code: string,
	settings: Pick<ExtensionSettings, "savedCodeFormat" | "includePrettifiedCode">
): Promise<FormattedSubmissionCode> => {
	const original = code;
	let primary = original;

	if (settings.savedCodeFormat === "minified") {
		primary = minifySubmissionCode(original);
	} else if (settings.savedCodeFormat === "prettified") {
		primary = await prettifySubmissionCode(original);
	}

	let prettifiedExtra: string | undefined;
	if (settings.includePrettifiedCode && settings.savedCodeFormat !== "prettified") {
		prettifiedExtra = await prettifySubmissionCode(original);
	}

	return { primary, prettifiedExtra };
};

export const formatEditorCode = async (
	code: string,
	format: EditorCodeFormat
): Promise<string> => {
	if (format === "minified") {
		return minifySubmissionCode(code);
	}
	return prettifySubmissionCode(code);
};
