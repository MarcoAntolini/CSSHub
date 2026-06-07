import type { ReactElement } from "react";
import type {
	SubmissionIngestionResponse,
	SubmissionPayload,
} from "../shared/contracts";
import { getIngestionTone, statusTextFromTone } from "../shared/eventTone";
import { SubmissionCard } from "./SubmissionCard";
import { relativeTime } from "./utils";

export const LastSubmissionSection = ({
	lastSubmission,
	lastIngestion,
}: {
	lastSubmission: SubmissionPayload | null;
	lastIngestion: SubmissionIngestionResponse | null;
}): ReactElement => {
	const statusTone = getIngestionTone(lastIngestion);
	const statusText = statusTextFromTone(statusTone, "—");

	return (
		<section className="card card-compact">
			<h2 className="card-heading">Last submission</h2>
			{lastSubmission ? (
				<SubmissionCard
					view={{
						title: lastSubmission.challengeName,
						meta: [
							lastSubmission.matchPct != null
								? `${lastSubmission.matchPct}% match`
								: null,
							lastSubmission.score != null
								? `${lastSubmission.score} score`
								: null,
							relativeTime(lastSubmission.submittedAt),
						]
							.filter((part): part is string => Boolean(part))
							.join(" · "),
						tone: statusTone,
						statusText,
						reason: lastIngestion?.reason ?? "",
						commitUrl: lastIngestion?.commitUrl ?? null,
					}}
				/>
			) : (
				<p className="last-empty">
					No submission yet. Submit on CSSBattle to see it here.
				</p>
			)}
		</section>
	);
};
