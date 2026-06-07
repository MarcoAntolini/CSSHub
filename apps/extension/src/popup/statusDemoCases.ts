import type { SubmissionCardView } from "./types";

export const STATUS_DEMO_CASES: Array<{ label: string; view: SubmissionCardView }> =
	[
		{
			label: "Commit success",
			view: {
				title: "Carrom",
				meta: "99.2% match · 640 score · just now",
				tone: "success",
				statusText: "committed",
				reason: "Submission committed to GitHub.",
				commitUrl: "#",
			},
		},
		{
			label: "Skipped · best kept",
			view: {
				title: "Carrom",
				meta: "98.5% match · 612 score · just now",
				tone: "warn",
				statusText: "skipped",
				reason:
					"Submission skipped: current 98.50% / 612 does not beat best 99.20% / 640.",
			},
		},
		{
			label: "Skipped · below threshold",
			view: {
				title: "Carrom",
				meta: "82.4% match · 380 score · just now",
				tone: "warn",
				statusText: "skipped",
				reason: "Submission below threshold.",
			},
		},
		{
			label: "Skipped · score is 0",
			view: {
				title: "Carrom",
				meta: "— · 0 score · just now",
				tone: "warn",
				statusText: "skipped",
				reason:
					"Submission skipped because Last score is zero, unavailable, or invalid.",
			},
		},
		{
			label: "Skipped · duplicate",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "warn",
				statusText: "skipped",
				reason:
					"Duplicate submission skipped: same challenge, code, and score within 45s window.",
			},
		},
		{
			label: "Action needed · auth missing",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "Submission accepted but GitHub is not authenticated.",
			},
		},
		{
			label: "Action needed · repo missing",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "Submission accepted but no repository selected.",
			},
		},
		{
			label: "Error · repo/branch not found",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "Repository or branch not found. Verify repository settings.",
			},
		},
		{
			label: "Error · GitHub rejected operation",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "GitHub rejected this operation. Check repository and branch.",
			},
		},
		{
			label: "Error · rate limit",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "GitHub rate limit reached. Retry in a few minutes.",
			},
		},
		{
			label: "Error · GitHub unavailable",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "GitHub is temporarily unavailable. Try again shortly.",
			},
		},
		{
			label: "Error · network",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "Network error while contacting GitHub services.",
			},
		},
		{
			label: "Error · unexpected",
			view: {
				title: "Carrom",
				meta: "97.1% match · 540 score · just now",
				tone: "error",
				statusText: "failed",
				reason: "Operation failed. Check settings and try again.",
			},
		},
	];
