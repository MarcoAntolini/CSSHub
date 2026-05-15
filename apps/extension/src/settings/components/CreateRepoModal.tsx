import type { KeyboardEvent as ReactKeyboardEvent, ReactElement, RefObject } from "react";

type CreateRepoModalProps = {
	createModalRef: RefObject<HTMLDivElement | null>;
	createNameInputRef: RefObject<HTMLInputElement | null>;
	createName: string;
	createPrivate: boolean;
	busy: boolean;
	onCreateNameChange: (value: string) => void;
	onCreatePrivateChange: (checked: boolean) => void;
	onClose: () => void;
	onConfirm: () => void;
	onKeyDown: (
		event: ReactKeyboardEvent<HTMLDivElement>,
		container: HTMLDivElement | null,
		closeModal: () => void
	) => void;
};

export const CreateRepoModal = ({
	createModalRef,
	createNameInputRef,
	createName,
	createPrivate,
	busy,
	onCreateNameChange,
	onCreatePrivateChange,
	onClose,
	onConfirm,
	onKeyDown,
}: CreateRepoModalProps): ReactElement => (
	<div className="modal-backdrop" role="presentation" onClick={onClose}>
		<div
			ref={createModalRef}
			className="modal-panel"
			role="dialog"
			aria-modal="true"
			aria-labelledby="create-repository-title"
			tabIndex={-1}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(event) =>
				onKeyDown(event, createModalRef.current, onClose)
			}
		>
			<h2 className="modal-head" id="create-repository-title">
				Create repository
			</h2>
			<div className="modal-body">
				<div className="row">
					<label htmlFor="cr-name">Name</label>
					<input
						ref={createNameInputRef}
						id="cr-name"
						type="text"
						value={createName}
						onChange={(e) => onCreateNameChange(e.target.value)}
						placeholder="my-cssbattles"
					/>
				</div>
				<div className="row checkbox-row">
					<label htmlFor="cr-priv">Private</label>
					<input
						id="cr-priv"
						type="checkbox"
						checked={createPrivate}
						onChange={(e) => onCreatePrivateChange(e.target.checked)}
					/>
				</div>
			</div>
			<div className="modal-foot">
				<button type="button" className="btn btn-ghost" onClick={onClose}>
					Cancel
				</button>
				<button
					type="button"
					className="btn btn-primary"
					onClick={onConfirm}
					disabled={busy}
				>
					Create
				</button>
			</div>
		</div>
	</div>
);
