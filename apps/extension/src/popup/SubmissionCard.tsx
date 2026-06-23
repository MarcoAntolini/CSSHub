import type { ReactElement } from "react";
import type { SubmissionCardView } from "./types";

export const SubmissionCard = ({
	view,
}: {
	view: SubmissionCardView;
}): ReactElement => (
	<div className="last-card" aria-busy={view.processing ? "true" : undefined}>
		<div className="last-row-head">
			<span className="last-title" title={view.title}>
				{view.title}
			</span>
			<span className={`last-status last-status-${view.tone}`}>
				{view.processing ? (
					<span className="last-status-spinner" aria-hidden="true" />
				) : null}
				{view.statusText}
			</span>
		</div>
		{view.meta ? <p className="last-meta">{view.meta}</p> : null}
		{view.reason ? (
			<p className={`last-reason last-reason-${view.tone}`}>{view.reason}</p>
		) : null}
		{view.commitUrl ? (
			<a
				href={view.commitUrl}
				target="_blank"
				rel="noreferrer"
				className="last-commit-link"
				onClick={(e) => {
					if (view.commitUrl === "#") {
						e.preventDefault();
					}
				}}
			>
				View commit ↗
			</a>
		) : null}
	</div>
);
