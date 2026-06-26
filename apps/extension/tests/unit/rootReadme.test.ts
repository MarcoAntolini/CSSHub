import { describe, expect, it } from "vitest";

import {

	CSSHUB_README_END,

	CSSHUB_README_START,

	buildRootReadmeContent,

	collectChallengeIndexBuckets,

	encodeRepoPathForMarkdownLink,

	formatIndexLinkHtml,

	formatSummaryHtml,

	formatDailyDateLabelFromIso,
	formatGroupedReadmeIndex,
	groupBattleEntriesByGroup,
	groupDailyEntriesByMonth,

	injectManagedReadmeSection,

	parseExistingReadmeLabels,

} from "@/rootReadme";



describe("collectChallengeIndexBuckets", () => {

	it("groups battles, daily, and legacy paths", () => {

		const paths = new Set([

			"Battles/Battle #39/#254. Unfitting/submission.json",

			"Daily Targets/2026-06-04/submission.json",

			"challenges/1/submission.json",

		]);

		const buckets = collectChallengeIndexBuckets(

			paths,

			"Battles/Battle #40/#255. Next",

			"#255. Next"

		);

		expect(buckets.battles.map((e) => e.folder)).toEqual([

			"Battles/Battle #39/#254. Unfitting",

			"Battles/Battle #40/#255. Next",

		]);

		expect(buckets.daily.map((e) => e.folder)).toEqual(["Daily Targets/2026-06-04"]);

		expect(buckets.legacy.map((e) => e.folder)).toEqual(["challenges/1"]);

	});

});



describe("formatSummaryHtml", () => {
	it("formats nested battle group summaries", () => {
		expect(formatSummaryHtml("Battle #1", 2)).toBe(
			"<summary><strong>Battle #1 (2)</strong></summary>"
		);
	});

	it("formats finished battle progress as synced over total", () => {
		expect(
			formatSummaryHtml("Battle #1", 2, {
				totalChallenges: 4,
				status: "finished",
			})
		).toBe("<summary><strong>Battle #1 (2/4)</strong></summary>");
	});

	it("formats unfinished battle progress with a plus suffix", () => {
		expect(
			formatSummaryHtml("Battle #1", 2, {
				totalChallenges: 4,
				status: "unfinished",
			})
		).toBe("<summary><strong>Battle #1 (2/4+)</strong></summary>");
	});
});

describe("formatIndexLinkHtml", () => {

	it("emits HTML list links for GitHub details blocks", () => {

		expect(

			formatIndexLinkHtml({

				folder: "Battles/Battle #1/#1. Simply Square",

				label: "#1. Simply Square",

			})

		).toBe(

			'<li><a href="./Battles/Battle%20%231/%231.%20Simply%20Square/">#1. Simply Square</a></li>'

		);

	});

	it("renders character counts outside the challenge link", () => {
		expect(
			formatIndexLinkHtml({
				folder: "Battles/Battle #1/#4. Ups n Downs",
				label: "#4. Ups n Downs (404 Characters)",
			})
		).toBe(
			'<li><a href="./Battles/Battle%20%231/%234.%20Ups%20n%20Downs/">#4. Ups n Downs</a> (404 Characters)</li>'
		);
	});

});



describe("formatGroupedReadmeIndex", () => {
	it("separates top-level sections with a blank line for GitHub heading parsing", () => {
		const out = formatGroupedReadmeIndex({
			battles: [{ folder: "Battles/Battle #1/#1. A", label: "#1. A" }],
			daily: [{ folder: "Daily Targets/2026-06-04", label: "Jun 4, 2026" }],
			legacy: [{ folder: "challenges/1", label: "Target 1" }],
		});
		expect(out).toContain("</ul>\n\n### Daily Targets");
		expect(out).toContain("</ul>\n\n### Legacy");
	});

	it("formats the current daily month as saved over available days", () => {
		const out = formatGroupedReadmeIndex(
			{
				battles: [],
				daily: [
					{ folder: "Daily Targets/2026-06-01", label: "Jun 1, 2026" },
					{ folder: "Daily Targets/2026-06-04", label: "Jun 4, 2026" },
				],
				legacy: [],
			},
			undefined,
			undefined,
			{ generatedAt: new Date("2026-06-20T12:00:00.000Z") }
		);

		expect(out).toContain("<summary><strong>June 2026 (2/20+)</strong></summary>");
		expect(out).toContain("### Daily Targets (2)");
	});

	it("drops the unfinished suffix on the last day of the current daily month", () => {
		const out = formatGroupedReadmeIndex(
			{
				battles: [],
				daily: [
					{ folder: "Daily Targets/2026-02-01", label: "Feb 1, 2026" },
					{ folder: "Daily Targets/2026-02-28", label: "Feb 28, 2026" },
				],
				legacy: [],
			},
			undefined,
			undefined,
			{ generatedAt: new Date("2026-02-28T12:00:00.000Z") }
		);

		expect(out).toContain("<summary><strong>February 2026 (2/28)</strong></summary>");
	});

	it("uses calendar month lengths for completed daily months", () => {
		const out = formatGroupedReadmeIndex(
			{
				battles: [],
				daily: [
					{ folder: "Daily Targets/2024-02-29", label: "Feb 29, 2024" },
					{ folder: "Daily Targets/2026-04-01", label: "Apr 1, 2026" },
					{ folder: "Daily Targets/2026-05-01", label: "May 1, 2026" },
				],
				legacy: [],
			},
			undefined,
			undefined,
			{ generatedAt: new Date("2026-06-20T12:00:00.000Z") }
		);

		expect(out).toContain("<summary><strong>February 2024 (1/29)</strong></summary>");
		expect(out).toContain("<summary><strong>April 2026 (1/30)</strong></summary>");
		expect(out).toContain("<summary><strong>May 2026 (1/31)</strong></summary>");
	});
});

describe("groupDailyEntriesByMonth", () => {
	it("clusters daily targets by year-month, ascending like battle groups", () => {
		const entries = [
			{ folder: "Daily Targets/2026-05-15", label: "May 15, 2026" },
			{ folder: "Daily Targets/2026-06-04", label: "Jun 4, 2026" },
			{ folder: "Daily Targets/2026-06-01", label: "Jun 1, 2026" },
		];
		const groups = groupDailyEntriesByMonth(entries);
		expect(groups.map((g) => g.monthLabel)).toEqual(["May 2026", "June 2026"]);
		expect(groups[0].entries).toHaveLength(1);
		expect(groups[1].entries).toHaveLength(2);
	});
});

describe("formatDailyDateLabelFromIso", () => {
	it("formats ISO dates for index link labels", () => {
		expect(formatDailyDateLabelFromIso("2026-06-04")).toBe("Jun 4, 2026");
	});
});

describe("groupBattleEntriesByGroup", () => {

	it("clusters challenges under their battle group", () => {

		const entries = [

			{ folder: "Battles/Battle #39/#254. Unfitting", label: "#254. Unfitting" },

			{ folder: "Battles/Battle #1/#1. Simply Square", label: "#1. Simply Square" },

			{ folder: "Battles/Battle #39/#255. Next", label: "#255. Next" },

		];

		expect(groupBattleEntriesByGroup(entries).map((g) => g.group)).toEqual([

			"Battle #1",

			"Battle #39",

		]);

		expect(groupBattleEntriesByGroup(entries)[1].entries).toHaveLength(2);

	});

	it("sorts challenges numerically within a battle group", () => {
		const entries = [
			{ folder: "Battles/Battle #1/#10. Cloaked Spirits", label: "#10. Cloaked Spirits" },
			{ folder: "Battles/Battle #1/#2. Carrom", label: "#2. Carrom" },
			{ folder: "Battles/Battle #1/#1. Simply Square", label: "#1. Simply Square" },
			{ folder: "Battles/Battle #1/#11. Eye of Sauron", label: "#11. Eye of Sauron" },
			{ folder: "Battles/Battle #1/#9. Tesseract", label: "#9. Tesseract" },
		];
		const sorted = groupBattleEntriesByGroup(entries)[0].entries.map((e) => e.label);
		expect(sorted).toEqual([
			"#1. Simply Square",
			"#2. Carrom",
			"#9. Tesseract",
			"#10. Cloaked Spirits",
			"#11. Eye of Sauron",
		]);
	});

});



describe("encodeRepoPathForMarkdownLink", () => {

	it("encodes hash and spaces per segment", () => {

		expect(encodeRepoPathForMarkdownLink("Battles/Battle #39/#254. Unfitting")).toBe(

			"Battles/Battle%20%2339/%23254.%20Unfitting"

		);

	});

});



describe("parseExistingReadmeLabels", () => {

	it("extracts labels from markdown index links", () => {

		const readme = [

			"- [Target 8: Forking Crazy](./challenges/8/)",

			"not a link",

		].join("\n");

		expect(parseExistingReadmeLabels(readme)).toEqual(

			new Map([["challenges/8", "Target 8: Forking Crazy"]])

		);

	});



	it("extracts labels from HTML index links", () => {

		const readme =

			'<li><a href="./Battles/Battle%20%2339/%23254.%20Unfitting/">#254. Unfitting</a></li>';

		expect(parseExistingReadmeLabels(readme)).toEqual(

			new Map([["Battles/Battle #39/#254. Unfitting", "#254. Unfitting"]])

		);

	});

	it("decodes HTML labels before preserving them", () => {
		const readme =
			'<li><a href="./Battles/Battle%20%231/%231.%20A%20%26%20B/">#1. A &amp; B (225 Characters)</a></li>';

		expect(parseExistingReadmeLabels(readme)).toEqual(
			new Map([["Battles/Battle #1/#1. A & B", "#1. A & B (225 Characters)"]])
		);
	});

	it("preserves character counts rendered after HTML links", () => {
		const readme =
			'<li><a href="./Battles/Battle%20%231/%231.%20Simply%20Square/">#1. Simply Square</a> (55 Characters)</li>';

		expect(parseExistingReadmeLabels(readme)).toEqual(
			new Map([["Battles/Battle #1/#1. Simply Square", "#1. Simply Square (55 Characters)"]])
		);
	});

});



describe("buildRootReadmeContent", () => {

	it("returns null when mode is off", () => {

		expect(

			buildRootReadmeContent({

				mode: "off",

				existingReadme: "# Hi",

				existingBlobPaths: new Set(),

				challengeFolder: "Battles/Battle #1/#42. Carrom",

				challengeTitle: "#42. Carrom",

			})

		).toBeNull();

	});



	it("managed: appends collapsible sections when README has no markers", () => {

		const out = buildRootReadmeContent({

			mode: "managed-section",

			existingReadme: "# My repo\n\nHello.",

			existingBlobPaths: new Set([

				"challenges/1/submission.json",

				"Daily Targets/2026-06-01/submission.json",

			]),

			challengeFolder: "Battles/Battle #2/#3. New",

			challengeTitle: "#3. New",

		});

		expect(out).toContain("# My repo");

		expect(out).toContain("Hello.");

		expect(out).toContain(CSSHUB_README_START);

		expect(out).toContain(CSSHUB_README_END);

		expect(out).toContain("### Battles (1)");
		expect(out).toContain("### Daily Targets (1)");
		expect(out).toContain("<strong>June 2026");
		expect(out).toContain("### Legacy (1)");
		expect(out).not.toContain("<foreignObject");
		expect(out).not.toContain(".csshub-h");
		expect(out).toContain("<details>");
		expect(out).toContain("<strong>Battle #2 (1)</strong>");
		expect(out).not.toContain("<blockquote>");

		expect(out).toContain('<a href="./Battles/Battle%20%232/%233.%20New/">#3. New</a>');

		expect(out).not.toMatch(/\[\s*#3\. New\s*\]\(/);

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

			existingBlobPaths: new Set(["Battles/Battle #1/#10. Ten/submission.json"]),

			challengeFolder: "Battles/Battle #1/#10. Ten",

			challengeTitle: "#10. Ten",

		});

		expect(out).toContain("Intro stays.");

		expect(out).toContain("Footer stays.");

		expect(out).not.toContain("\nold\n");

		expect(out).toContain("#10. Ten");

		expect(out).toContain("## CssHub challenge index");

	});



	it("managed: preserves titles from existing index when adding a challenge", () => {

		const battlePath = encodeRepoPathForMarkdownLink("Battles/Battle #1/#8. Forking");

		const existing = `# My repo



${CSSHUB_README_START}

## CssHub challenge index



### Battles (1)

<ul>
<li>
<details>
<summary><strong>Battle #1 (1)</strong></summary>

<ul>
<li><a href="./${battlePath}/">Target 8: Forking Crazy</a></li>
</ul>
</details>
</li>
</ul>

${CSSHUB_README_END}`;

		const out = buildRootReadmeContent({

			mode: "managed-section",

			existingReadme: existing,

			existingBlobPaths: new Set(["Battles/Battle #1/#8. Forking/submission.json"]),

			challengeFolder: "Battles/Battle #1/#11. Eye",

			challengeTitle: "#11. Eye of Sauron",

		});

		expect(out).toContain("Target 8: Forking Crazy");

		expect(out).toContain("Battle #1 (2)");

		expect(out).toContain("#11. Eye of Sauron");

	});



	it("managed: preserves old labels but uses the current resynced label", () => {
		const oldBattlePath = encodeRepoPathForMarkdownLink("Battles/Battle #1/#8. Forking");
		const currentBattlePath = encodeRepoPathForMarkdownLink("Battles/Battle #1/#11. Eye");
		const existing = `# My repo

${CSSHUB_README_START}
## CssHub challenge index

### Battles (2)

<ul>
<li>
<details>
<summary><strong>Battle #1 (2)</strong></summary>

<ul>
<li><a href="./${oldBattlePath}/">Target 8: Forking Crazy</a></li>
<li><a href="./${currentBattlePath}/">#11. Eye of Sauron</a></li>
</ul>
</details>
</li>
</ul>

${CSSHUB_README_END}`;

		const out = buildRootReadmeContent({
			mode: "managed-section",
			existingReadme: existing,
			existingBlobPaths: new Set([
				"Battles/Battle #1/#8. Forking/submission.json",
				"Battles/Battle #1/#11. Eye/submission.json",
			]),
			challengeFolder: "Battles/Battle #1/#11. Eye",
			challengeTitle: "#11. Eye of Sauron (225 Characters)",
		});

		expect(out).toContain("Target 8: Forking Crazy");
		expect(out).toContain("#11. Eye of Sauron</a> (225 Characters)");
		expect(out).not.toContain("#11. Eye of Sauron (225 Characters)</a>");
	});

	it("managed: preserves character counts for existing challenge links", () => {
		const oldBattlePath = encodeRepoPathForMarkdownLink(
			"Battles/Battle #2023/#236. Missing Slice"
		);
		const existing = `# My repo

${CSSHUB_README_START}
## CssHub challenge index

### Battles (1)

<ul>
<li>
<details>
<summary><strong>Battle #2023 (1)</strong></summary>

<ul>
<li><a href="./${oldBattlePath}/">#236. Missing Slice</a> (212 Characters)</li>
</ul>
</details>
</li>
</ul>

${CSSHUB_README_END}`;

		const out = buildRootReadmeContent({
			mode: "managed-section",
			existingReadme: existing,
			existingBlobPaths: new Set([
				"Battles/Battle #2023/#236. Missing Slice/submission.json",
			]),
			challengeFolder: "Battles/Battle #2023/#233. Push Button",
			challengeTitle: "#233. Push Button (236 Characters)",
			battleMetadataByGroup: new Map([
				[
					"Battle #2023",
					{
						totalChallenges: 124,
						status: "unfinished",
					},
				],
			]),
		});

		expect(out).toContain("#236. Missing Slice</a> (212 Characters)");
		expect(out).toContain("#233. Push Button</a> (236 Characters)");
		expect(out).toContain("<strong>Battle #2023 (2/124+)</strong>");
	});

	it("managed: nests multiple battles under separate Battle # sections", () => {

		const out = buildRootReadmeContent({

			mode: "managed-section",

			existingReadme: "",

			existingBlobPaths: new Set([

				"Battles/Battle #1/#1. Simply Square/submission.json",

				"Battles/Battle #39/#254. Unfitting/submission.json",

			]),

			challengeFolder: "Battles/Battle #1/#1. Simply Square",

			challengeTitle: "#1. Simply Square",

		});

		expect(out).toContain("### Battles (2)");

		expect(out).toContain("<strong>Battle #1 (1)</strong>");

		expect(out).toContain("<strong>Battle #39 (1)</strong>");

		expect(out).toContain('<a href="./Battles/Battle%20%231/%231.%20Simply%20Square/">#1. Simply Square</a>');

		expect(out).toContain('<a href="./Battles/Battle%20%2339/%23254.%20Unfitting/">#254. Unfitting</a>');

	});

	it("managed: includes battle progress and plus legend for unfinished battles", () => {
		const out = buildRootReadmeContent({
			mode: "managed-section",
			existingReadme: "",
			existingBlobPaths: new Set(["Battles/Battle #39/#254. Unfitting/submission.json"]),
			challengeFolder: "Battles/Battle #39/#255. Next",
			challengeTitle: "#255. Next",
			battleMetadataByGroup: new Map([
				[
					"Battle #39",
					{
						totalChallenges: 8,
						status: "unfinished",
					},
				],
			]),
		});

		expect(out).toContain("<strong>Battle #39 (2/8+)</strong>");
		expect(out).toContain("+ means this battle may receive more targets.");
	});

	it("managed: omits the plus legend for finished battle progress", () => {
		const out = buildRootReadmeContent({
			mode: "managed-section",
			existingReadme: "",
			existingBlobPaths: new Set(["Battles/Battle #39/#254. Unfitting/submission.json"]),
			challengeFolder: "Battles/Battle #39/#255. Next",
			challengeTitle: "#255. Next",
			battleMetadataByGroup: new Map([
				[
					"Battle #39",
					{
						totalChallenges: 8,
						status: "finished",
					},
				],
			]),
		});

		expect(out).toContain("<strong>Battle #39 (2/8)</strong>");
		expect(out).not.toContain("+ means this battle may receive more targets.");
	});



	it("full: replaces entire README with grouped index", () => {

		const out = buildRootReadmeContent({

			mode: "full",

			existingReadme: "# USER\n\nDo not keep me",

			existingBlobPaths: new Set(),

			challengeFolder: "Daily Targets/2026-06-04",

			challengeTitle: "Daily Target — Jun 4, 2026",

		});

		expect(out).not.toContain("Do not keep me");

		expect(out).toContain("# CssHub — CSSBattle solutions");

		expect(out).toContain("### Daily Targets (1)");

		expect(out).toContain("Jun 4, 2026");

	});

});



describe("injectManagedReadmeSection", () => {

	it("creates markers-only file when existing is empty", () => {

		const block =

			'## CssHub challenge index\n\n### Legacy (1)\n\n<ul>\n<li><a href="./challenges/a/">A</a></li>\n</ul>';

		const out = injectManagedReadmeSection("", block);

		expect(out.trim()).toContain(CSSHUB_README_START);

		expect(out).toContain('<a href="./challenges/a/">A</a>');

		expect(out).toContain(CSSHUB_README_END);

	});

});


