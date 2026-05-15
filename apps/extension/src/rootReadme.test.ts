import { describe, expect, it } from "vitest";
import {
	CSSHUB_README_END,
	CSSHUB_README_START,
	buildRootReadmeContent,
	collectChallengeKeys,
	injectManagedReadmeSection,
} from "./rootReadme";

describe("collectChallengeKeys", () => {
	it("merges tree paths with the current challenge folder", () => {
		const paths = new Set(["challenges/1/submission.json", "challenges/2/submission.json"]);
		expect(collectChallengeKeys(paths, "challenges/3")).toEqual(["1", "2", "3"]);
	});
});

describe("buildRootReadmeContent", () => {
	it("returns null when mode is off", () => {
		expect(
			buildRootReadmeContent({
				mode: "off",
				existingReadme: "# Hi",
				existingBlobPaths: new Set(),
				challengeFolder: "challenges/99",
				challengeTitle: "Target 99: Example",
			})
		).toBeNull();
	});

	it("managed: appends markers when README has no markers", () => {
		const out = buildRootReadmeContent({
			mode: "managed-section",
			existingReadme: "# My repo\n\nHello.",
			existingBlobPaths: new Set(["challenges/1/submission.json"]),
			challengeFolder: "challenges/2",
			challengeTitle: "Target 2: New",
		});
		expect(out).toContain("# My repo");
		expect(out).toContain("Hello.");
		expect(out).toContain(CSSHUB_README_START);
		expect(out).toContain(CSSHUB_README_END);
		expect(out).toContain("./challenges/1/");
		expect(out).toContain("./challenges/2/");
		expect(out).toContain("Target 2: New");
	});

	it("managed: replaces only the marked region", () => {
		const existing = `Intro stays.

${CSSHUB_README_START}
old
${CSSHUB_README_END}

Footer stays.`;
		const out = buildRootReadmeContent({
			mode: "managed-section",
			existingReadme: existing,
			existingBlobPaths: new Set(["challenges/10/submission.json"]),
			challengeFolder: "challenges/10",
			challengeTitle: "Target 10: Ten",
		});
		expect(out).toContain("Intro stays.");
		expect(out).toContain("Footer stays.");
		expect(out).not.toContain("\nold\n");
		expect(out).toContain("Target 10: Ten");
		expect(out).toContain("## CssHub challenge index");
	});

	it("full: replaces entire README", () => {
		const out = buildRootReadmeContent({
			mode: "full",
			existingReadme: "# USER\n\nDo not keep me",
			existingBlobPaths: new Set(),
			challengeFolder: "challenges/5",
			challengeTitle: "Target 5: Five",
		});
		expect(out).not.toContain("Do not keep me");
		expect(out).toContain("# CssHub — CSSBattle solutions");
		expect(out).toContain("./challenges/5/");
		expect(out).toContain("Target 5: Five");
	});
});

describe("injectManagedReadmeSection", () => {
	it("creates markers-only file when existing is empty", () => {
		const block = "## CssHub challenge index\n\n- [A](./challenges/a/)";
		const out = injectManagedReadmeSection("", block);
		expect(out.trim()).toContain(CSSHUB_README_START);
		expect(out).toContain("- [A](./challenges/a/)");
		expect(out).toContain(CSSHUB_README_END);
	});
});
