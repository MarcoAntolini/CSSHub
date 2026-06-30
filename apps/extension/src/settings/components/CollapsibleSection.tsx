import type { ReactElement, ReactNode } from "react";
import { useId, useState } from "react";

type CollapsibleSectionProps = {
	id: string;
	title: string;
	summary?: string;
	defaultOpen?: boolean;
	headerActions?: ReactNode;
	children: ReactNode;
};

export const CollapsibleSection = ({
	id,
	title,
	summary,
	defaultOpen = true,
	headerActions,
	children,
}: CollapsibleSectionProps): ReactElement => {
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();

	return (
		<section className={`settings-section collapsible-section${open ? " is-open" : ""}`}>
			<div className="collapsible-header">
				<button
					type="button"
					className="collapsible-trigger"
					aria-expanded={open}
					aria-controls={panelId}
					onClick={() => setOpen((value) => !value)}
				>
					<span className="collapsible-chevron" aria-hidden="true" />
					<span className="collapsible-heading">
						<span className="collapsible-title">{title}</span>
						{summary ? <span className="collapsible-summary">{summary}</span> : null}
					</span>
				</button>
				{headerActions ? (
					<div className="collapsible-header-actions">{headerActions}</div>
				) : null}
			</div>
			<div
				id={panelId}
				className="collapsible-panel"
				hidden={!open}
				role="region"
				aria-labelledby={id}
			>
				{children}
			</div>
		</section>
	);
};
