import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, RefObject } from "react";
import type { Repo } from "../../shared/contracts";

type PickRepoModalProps = {
	pickModalRef: RefObject<HTMLDivElement | null>;
	pickSearchInputRef: RefObject<HTMLInputElement | null>;
	pickSearch: string;
	pickSelected: Repo | null;
	filteredPickList: Repo[];
	busy: boolean;
	onPickSearchChange: (value: string) => void;
	onPickSelected: (repo: Repo) => void;
	onClose: () => void;
	onConfirm: () => void;
	onKeyDown: (
		event: ReactKeyboardEvent<HTMLDivElement>,
		container: HTMLDivElement | null,
		closeModal: () => void
	) => void;
};

export const PickRepoModal = ({
	pickModalRef,
	pickSearchInputRef,
	pickSearch,
	pickSelected,
	filteredPickList,
	busy,
	onPickSearchChange,
	onPickSelected,
	onClose,
	onConfirm,
	onKeyDown,
}: PickRepoModalProps): ReactElement => (
	<div className="modal-backdrop" role="presentation" onClick={onClose}>
		<div
			ref={pickModalRef}
			className="modal-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="choose-repository-title"
			tabIndex={-1}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(event) => onKeyDown(event, pickModalRef.current, onClose)}
		>
			<h2 className="modal-head" id="choose-repository-title">
				Choose repository
			</h2>
			<div className="modal-body">
				<div className="row">
					<label htmlFor="pick-q">Search</label>
					<input
						ref={pickSearchInputRef}
						id="pick-q"
						type="text"
						value={pickSearch}
						onChange={(e) => onPickSearchChange(e.target.value)}
						placeholder="owner/repo…"
					/>
				</div>
				<div
					className="repo-picker-list"
					role="listbox"
					aria-label="Available repositories"
				>
					{filteredPickList.map((r) => (
						<button
							key={r.id}
							id={`repo-option-${r.id}`}
							type="button"
							role="option"
							aria-selected={pickSelected?.id === r.id}
							className={`repo-picker-item ${pickSelected?.id === r.id ? "selected" : ""}`}
							onClick={() => onPickSelected(r)}
						>
							{r.fullName}
							{r.private ? " · private" : ""}
						</button>
					))}
				</div>
				{filteredPickList.length === 0 ? (
					<p className="empty-state">No matches.</p>
				) : null}
			</div>
			<div className="modal-foot">
				<button type="button" className="btn btn-ghost" onClick={onClose}>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-primary"
					onClick={onConfirm}
					disabled={busy || !pickSelected}
				>
					Use repository
				</button>
			</div>
		</div>
	</div>
);
