import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type Dispatch,
	type SetStateAction,
} from "react";
import {
	popupToBackgroundMessageSchema,
	type Branch,
	type ExtensionSettings,
	type Repo,
} from "@/shared/contracts";
import type { LoadedState, UiNotice } from "@/settings/types";
import { validateBranchName } from "@/settings/utils";

type UseRepoPickerOptions = {
	data: LoadedState | null;
	setData: Dispatch<SetStateAction<LoadedState | null>>;
	busy: boolean;
	setBusy: (busy: boolean) => void;
	pushToast: (payload: UiNotice) => void;
	loadState: () => Promise<void>;
	saveSettingsRemote: (next: ExtensionSettings) => Promise<boolean>;
	refreshReposOnly: () => Promise<Repo[]>;
	refreshBranchesOnly: (repoFullName: string) => Promise<Branch[]>;
	storeModalTriggerFocus: () => void;
};

export const useRepoPicker = ({
	data,
	setData,
	busy: _busy,
	setBusy,
	pushToast,
	loadState,
	saveSettingsRemote,
	refreshReposOnly,
	refreshBranchesOnly,
	storeModalTriggerFocus,
}: UseRepoPickerOptions) => {
	const [createOpen, setCreateOpen] = useState(false);
	const [createName, setCreateName] = useState("");
	const [createPrivate, setCreatePrivate] = useState(true);

	const [pickOpen, setPickOpen] = useState(false);
	const [pickSearch, setPickSearch] = useState("");
	const [pickList, setPickList] = useState<Repo[]>([]);
	const [pickSelected, setPickSelected] = useState<Repo | null>(null);

	const [branches, setBranches] = useState<Branch[]>([]);
	const [branchesLoading, setBranchesLoading] = useState(false);
	const [createBranchName, setCreateBranchName] = useState("");
	const [createBranchFrom, setCreateBranchFrom] = useState("");
	const [readmeInfoOpen, setReadmeInfoOpen] = useState(false);

	const createNameInputRef = useRef<HTMLInputElement | null>(null);
	const pickSearchInputRef = useRef<HTMLInputElement | null>(null);

	const closeCreateModal = useCallback((): void => {
		setCreateOpen(false);
	}, []);

	const openCreateModal = useCallback((): void => {
		storeModalTriggerFocus();
		setCreateOpen(true);
	}, [storeModalTriggerFocus]);

	const closePickModal = useCallback((): void => {
		setPickOpen(false);
	}, []);

	const clearRepoSelection = useCallback(async (): Promise<void> => {
		if (!data) {
			return;
		}
		const ok = await saveSettingsRemote({
			...data.settings,
			selectedRepoFullName: null,
			selectedBranch: null,
		});
		if (ok) {
			setBranches([]);
			setCreateBranchFrom("");
			setCreateBranchName("");
			await loadState();
		}
	}, [data, loadState, saveSettingsRemote]);

	const openPickModal = useCallback(async (): Promise<void> => {
		storeModalTriggerFocus();
		setPickOpen(true);
		setPickSearch("");
		setPickSelected(null);
		setBusy(true);
		const repos = await refreshReposOnly();
		setPickList(repos);
		setBusy(false);
	}, [refreshReposOnly, setBusy, storeModalTriggerFocus]);

	const confirmPickRepo = useCallback(async (): Promise<void> => {
		if (!data || !pickSelected) {
			return;
		}
		const ok = await saveSettingsRemote({
			...data.settings,
			selectedRepoFullName: pickSelected.fullName,
			selectedBranch: pickSelected.defaultBranch,
		});
		if (ok) {
			setPickOpen(false);
			await loadState();
		}
	}, [data, loadState, pickSelected, saveSettingsRemote]);

	const confirmCreateRepo = useCallback(async (): Promise<void> => {
		if (!createName.trim()) {
			pushToast({
				level: "warn",
				message: "Repository name required",
			});
			return;
		}
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "createRepo",
			name: createName.trim(),
			private: createPrivate,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Repository creation failed",
			});
			return;
		}
		setCreateOpen(false);
		setCreateName("");
		pushToast({
			level: "success",
			message: "Repository created and selected",
		});
		await loadState();
	}, [createName, createPrivate, loadState, pushToast, setBusy]);

	const confirmCreateBranch = useCallback(async (): Promise<void> => {
		if (!data?.settings.selectedRepoFullName) {
			pushToast({
				level: "warn",
				message: "Select a repository first",
			});
			return;
		}

		const newBranchName = createBranchName.trim();
		const existing = new Set(branches.map((branch) => branch.name));
		const validationError = validateBranchName(newBranchName, existing);
		if (validationError) {
			pushToast({
				level: "warn",
				message: validationError,
			});
			return;
		}

		const repoMeta =
			data.repos.find(
				(r) => r.fullName === data.settings.selectedRepoFullName
			) ?? null;
		const fromBranch =
			createBranchFrom ||
			data.settings.selectedBranch ||
			repoMeta?.defaultBranch ||
			branches[0]?.name ||
			"";
		if (!fromBranch) {
			pushToast({
				level: "warn",
				message: "No source branch available",
			});
			return;
		}

		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "createBranch",
			repoFullName: data.settings.selectedRepoFullName,
			newBranch: newBranchName,
			fromBranch,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Branch creation failed",
			});
			return;
		}

		const nextSelection = {
			...data.settings,
			selectedBranch: newBranchName,
		};
		setCreateBranchName("");
		setCreateBranchFrom(newBranchName);
		setData((prev) => (prev ? { ...prev, settings: nextSelection } : prev));
		pushToast({
			level: "success",
			message: `Branch ${newBranchName} created`,
		});
		const fetched = await refreshBranchesOnly(
			data.settings.selectedRepoFullName
		);
		setBranches(fetched);
	}, [
		branches,
		createBranchFrom,
		createBranchName,
		data,
		pushToast,
		refreshBranchesOnly,
		setBusy,
		setData,
	]);

	const filteredPickList = useMemo(() => {
		const q = pickSearch.trim().toLowerCase();
		if (!q) {
			return pickList;
		}
		return pickList.filter((r) => r.fullName.toLowerCase().includes(q));
	}, [pickList, pickSearch]);

	useEffect(() => {
		if (!data?.auth.isAuthenticated || !data.settings.selectedRepoFullName) {
			setBranches([]);
			setCreateBranchFrom("");
			return;
		}

		let cancelled = false;
		const repoFullName = data.settings.selectedRepoFullName;
		const selectedBranch = data.settings.selectedBranch;
		const defaultBranch =
			data.repos.find((repo) => repo.fullName === repoFullName)
				?.defaultBranch ?? null;

		setBranchesLoading(true);
		void refreshBranchesOnly(repoFullName)
			.then((fetched) => {
				if (cancelled) {
					return;
				}
				setBranches(fetched);
				const fallbackBranch = defaultBranch ?? fetched[0]?.name ?? null;
				const validSelection =
					selectedBranch &&
					fetched.some((branch) => branch.name === selectedBranch)
						? selectedBranch
						: fallbackBranch;
				if (validSelection) {
					setCreateBranchFrom((prev) =>
						prev && fetched.some((branch) => branch.name === prev)
							? prev
							: validSelection
					);
				} else {
					setCreateBranchFrom("");
				}

				if (
					selectedBranch &&
					validSelection &&
					selectedBranch !== validSelection
				) {
					void saveSettingsRemote({
						...data.settings,
						selectedBranch: validSelection,
					});
				}
			})
			.finally(() => {
				if (!cancelled) {
					setBranchesLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [data, refreshBranchesOnly, saveSettingsRemote]);

	const selectedRepoMeta =
		data?.repos.find(
			(r) => r.fullName === data.settings.selectedRepoFullName
		) ?? null;

	return {
		createOpen,
		createName,
		setCreateName,
		createPrivate,
		setCreatePrivate,
		pickOpen,
		pickSearch,
		setPickSearch,
		pickSelected,
		setPickSelected,
		branches,
		branchesLoading,
		createBranchName,
		setCreateBranchName,
		createBranchFrom,
		setCreateBranchFrom,
		readmeInfoOpen,
		setReadmeInfoOpen,
		createNameInputRef,
		pickSearchInputRef,
		closeCreateModal,
		openCreateModal,
		closePickModal,
		clearRepoSelection,
		openPickModal,
		confirmPickRepo,
		confirmCreateRepo,
		confirmCreateBranch,
		filteredPickList,
		selectedRepoMeta,
	};
};
