import type { ReactElement } from "react";
import type { SyncEvent } from "@/shared/contracts";
import { getSyncEventTone } from "@/shared/eventTone";
import { formatActivityTimestamp, getEventBadgeLabel } from "@/settings/utils";

type ActivityLogSectionProps = {
	recentEvents: SyncEvent[];
	busy: boolean;
	onClearActivityLog: () => void;
};

export const ActivityLogSection = ({
	recentEvents,
	busy,
	onClearActivityLog,
}: ActivityLogSectionProps): ReactElement => (
	<section className="settings-section">
		<div className="section-headline">
			<h2>Activity log</h2>
			<button
				type="button"
				className="btn btn-ghost btn-small"
				onClick={onClearActivityLog}
				disabled={busy || recentEvents.length === 0}
			>
				Clear log
			</button>
		</div>
		<p className="muted">
			Recent sync outcomes. For warnings and errors, the short code under the message
			matches what CssHub uses internally (not a stack trace).
		</p>
		{recentEvents.length === 0 ? (
			<p className="empty-state empty-state-activity">No events yet.</p>
		) : (
			<ul className="event-list" aria-label="Activity log">
				{recentEvents.map((ev) => {
					const tone = getSyncEventTone(ev);
					const showCode =
						Boolean(ev.code) && (tone === "error" || tone === "warn");
					return (
						<li key={ev.id} className={`event event-tone-${tone}`}>
							<div className="event-head">
								<span className={`event-pill event-pill-${tone}`}>
									{getEventBadgeLabel(ev)}
								</span>
								<time className="event-time" dateTime={ev.timestamp}>
									{formatActivityTimestamp(ev.timestamp)}
								</time>
							</div>
							<p className="event-message">{ev.message}</p>
							{showCode ? (
								<p className="event-code" aria-label="Event code">
									{ev.code}
								</p>
							) : null}
							{ev.commitUrl ? (
								<div className="event-foot">
									<a
										href={ev.commitUrl}
										target="_blank"
										rel="noreferrer"
										className={`event-link event-link-${tone}`}
									>
										View commit
									</a>
								</div>
							) : null}
						</li>
					);
				})}
			</ul>
		)}
	</section>
);
