// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	readCodeMirror6DocumentFromPage,
	writeCodeMirror6DocumentFromPage,
} from "@/background/handlers/captureHandlers";

describe("CSSBattle editor injection helpers", () => {
	beforeEach(() => {
		document.body.innerHTML = `
			<div class="cm-editor">
				<div class="cm-content"></div>
			</div>
		`;
	});

	it("reads and writes through the CodeMirror 6 cmView.view host", () => {
		const dispatch = vi.fn();
		const content = document.querySelector(".cm-content") as HTMLElement & {
			cmView?: unknown;
		};
		content.cmView = {
			view: {
				dispatch,
				state: {
					doc: {
						length: 12,
						toString: () => "<style></style>",
					},
				},
			},
		};

		expect(readCodeMirror6DocumentFromPage()).toBe("<style></style>");
		expect(writeCodeMirror6DocumentFromPage("<style>*{margin:0}</style>")).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({
			changes: {
				from: 0,
				to: 12,
				insert: "<style>*{margin:0}</style>",
			},
		});
	});

	it("can run after serialization without outer helper functions", () => {
		const dispatch = vi.fn();
		const content = document.querySelector(".cm-content") as HTMLElement & {
			cmView?: unknown;
		};
		content.cmView = {
			view: {
				dispatch,
				state: {
					doc: {
						length: 4,
						toString: () => "body{}",
					},
				},
			},
		};

		const serializedWriter = new Function(
			"code",
			`return (${writeCodeMirror6DocumentFromPage.toString()})(code);`
		) as (code: string) => boolean;
		const serializedReader = new Function(
			`return (${readCodeMirror6DocumentFromPage.toString()})();`
		) as () => string | null;

		expect(serializedReader()).toBe("body{}");
		expect(serializedWriter("a{}")).toBe(true);
		expect(dispatch).toHaveBeenCalledWith({
			changes: { from: 0, to: 4, insert: "a{}" },
		});
	});
});
