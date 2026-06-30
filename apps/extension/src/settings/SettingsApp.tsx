import type { ReactElement } from "react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { Toaster } from "sonner";
import { popupToBackgroundMessageSchema } from "@/shared/contracts";
import { useExtensionTheme } from "@/shared/ThemeToggle";
import {
	ActivityLogSection,
} from "./components/ActivityLogSection";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { CodeFormattingSection } from "./components/CodeFormattingSection";
import { CreateRepoModal } from "./components/CreateRepoModal";
import {
	GithubSetupSection,
	githubSetupSummary,
	githubSetupTitle,
} from "./components/GithubSetupSection";
import { LoadingShell } from "./components/LoadingShell";
import { NotificationsSection } from "./components/NotificationsSection";
import { PickRepoModal } from "./components/PickRepoModal";
import { SyncBehaviorSection } from "./components/SyncBehaviorSection";
import { SettingsHero } from "./components/SettingsHero";
import { useDeviceFlow } from "./hooks/useDeviceFlow";
import { useExtensionState } from "./hooks/useExtensionState";
import { useModalA11y } from "./hooks/useModalA11y";
import { useRepoPicker } from "./hooks/useRepoPicker";

export const SettingsApp = (): ReactElement => {
	const { theme, toggleTheme } = useExtensionTheme();
	const {
		data,
		setData,
		loading,
		busy,
		setBusy,
		loadState,
		saveSettingsRemote,
		refreshReposOnly,
		refreshBranchesOnly,
		pushToast,
	} = useExtensionState();

	const storeModalFocusRef = useRef<(() => void) | null>(null);

	const repoPicker = useRepoPicker({
		data,
		setData,
		busy,
		setBusy,
		pushToast,
		loadState,
		saveSettingsRemote,
		refreshReposOnly,
		refreshBranchesOnly,
		storeModalTriggerFocus: () => storeModalFocusRef.current?.(),
	});

	const modalA11y = useModalA11y({
		createOpen: repoPicker.createOpen,
		pickOpen: repoPicker.pickOpen,
		createNameInputRef: repoPicker.createNameInputRef,
		pickSearchInputRef: repoPicker.pickSearchInputRef,
	});

	storeModalFocusRef.current = modalA11y.storeModalTriggerFocus;

	const deviceFlow = useDeviceFlow({
		setBusy,
		pushToast,
		loadState,
	});

	const loginPat = async (token: string): Promise<boolean> => {
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "loginWithPat",
			token,
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "PAT login failed",
			});
			return false;
		}
		pushToast({
			level: "success",
			message: "GitHub account connected",
		});
		await loadState();
		return true;
	};

	const logout = async (): Promise<void> => {
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "logoutGithub",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Logout failed",
			});
			return;
		}
		deviceFlow.clearDeviceFlow();
		pushToast({
			level: "warn",
			message: "GitHub account disconnected",
		});
		await loadState();
	};

	const clearActivityLog = async (): Promise<void> => {
		setBusy(true);
		const message = popupToBackgroundMessageSchema.parse({
			action: "clearRecentEvents",
		});
		const response = await chrome.runtime.sendMessage(message);
		setBusy(false);
		if (!response?.ok) {
			pushToast({
				level: "error",
				message: response?.error ?? "Could not clear activity log",
			});
			return;
		}
		setData((prev) => (prev ? { ...prev, recentEvents: [] } : prev));
		pushToast({
			level: "success",
			message: "Activity log cleared",
		});
	};

	const toggleSystemNotifications = async (enabled: boolean): Promise<void> => {
		if (!data) {
			return;
		}
		await saveSettingsRemote({
			...data.settings,
			systemNotificationsEnabled: enabled,
		});
	};

	const saveSettings = (next: Parameters<typeof saveSettingsRemote>[0]): void => {
		void saveSettingsRemote(next);
	};

	const toaster = createPortal(
		<Toaster theme={theme} richColors position="top-center" closeButton />,
		document.body
	);

	if (loading || !data) {
		return (
			<>
				{toaster}
				<LoadingShell theme={theme} onToggleTheme={toggleTheme} />
			</>
		);
	}

	const { auth, settings, recentEvents } = data;

	return (
		<>
			{toaster}
			<main ref={modalA11y.appMainRef} className="settings-root">
				<SettingsHero theme={theme} onToggleTheme={toggleTheme} />
				<div className="settings-section-stack">
					<CollapsibleSection
						id="settings-github-setup"
						title={githubSetupTitle(auth)}
						summary={githubSetupSummary(auth, settings)}
						defaultOpen
					>
						<GithubSetupSection
							auth={auth}
							settings={settings}
							selectedRepoMeta={repoPicker.selectedRepoMeta}
							branches={repoPicker.branches}
							branchesLoading={repoPicker.branchesLoading}
							createBranchName={repoPicker.createBranchName}
							createBranchFrom={repoPicker.createBranchFrom}
							readmeInfoOpen={repoPicker.readmeInfoOpen}
							busy={busy}
							webAuthInProgress={deviceFlow.webAuthInProgress}
							deviceFlow={deviceFlow.deviceFlow}
							deviceCopyOk={deviceFlow.deviceCopyOk}
							onBeginWebFlow={() => void deviceFlow.beginWebFlow()}
							onBeginDeviceFlow={() => void deviceFlow.beginDeviceFlow()}
							onPollDevice={() => void deviceFlow.pollDevice()}
							onCopyDeviceUserCode={() => void deviceFlow.copyDeviceUserCode()}
							onOpenDeviceVerification={deviceFlow.openDeviceVerification}
							onLogout={() => void logout()}
							onLoginPat={loginPat}
							pushToast={pushToast}
							onCreateBranchNameChange={repoPicker.setCreateBranchName}
							onCreateBranchFromChange={repoPicker.setCreateBranchFrom}
							onReadmeInfoOpenChange={repoPicker.setReadmeInfoOpen}
							onOpenPickModal={() => void repoPicker.openPickModal()}
							onClearRepoSelection={() => void repoPicker.clearRepoSelection()}
							onOpenCreateModal={repoPicker.openCreateModal}
							onSaveSettings={saveSettings}
							onConfirmCreateBranch={() => void repoPicker.confirmCreateBranch()}
						/>
					</CollapsibleSection>

					{auth.isAuthenticated ? (
						<>
							<CollapsibleSection
								id="settings-notifications"
								title="Notifications & feedback"
								summary="Desktop notifications and on-page toasts"
								defaultOpen
							>
								<NotificationsSection
									settings={settings}
									busy={busy}
									onToggleSystemNotifications={(enabled) => {
										void toggleSystemNotifications(enabled);
									}}
									onSaveSettings={saveSettings}
								/>
							</CollapsibleSection>

							<CollapsibleSection
								id="settings-formatting"
								title="Code formatting"
								summary="README layout and editor tools"
								defaultOpen={false}
							>
								<CodeFormattingSection
									settings={settings}
									busy={busy}
									onSaveSettings={saveSettings}
								/>
							</CollapsibleSection>

							<CollapsibleSection
								id="settings-sync-behavior"
								title="How sync works"
								summary="Background processing and compatibility"
								defaultOpen={false}
							>
								<SyncBehaviorSection />
							</CollapsibleSection>

							<CollapsibleSection
								id="settings-activity"
								title="Activity log"
								summary={
									recentEvents.length === 0
										? "No events yet"
										: `${recentEvents.length} recent event${recentEvents.length === 1 ? "" : "s"}`
								}
								defaultOpen={recentEvents.length > 0}
							>
								<ActivityLogSection
									recentEvents={recentEvents}
									busy={busy}
									onClear={() => void clearActivityLog()}
								/>
							</CollapsibleSection>
						</>
					) : null}
				</div>
			</main>

			{repoPicker.createOpen ? (
				<CreateRepoModal
					createModalRef={modalA11y.createModalRef}
					createNameInputRef={repoPicker.createNameInputRef}
					createName={repoPicker.createName}
					createPrivate={repoPicker.createPrivate}
					busy={busy}
					onCreateNameChange={repoPicker.setCreateName}
					onCreatePrivateChange={repoPicker.setCreatePrivate}
					onClose={repoPicker.closeCreateModal}
					onConfirm={() => void repoPicker.confirmCreateRepo()}
					onKeyDown={modalA11y.onModalKeyDown}
				/>
			) : null}

			{repoPicker.pickOpen ? (
				<PickRepoModal
					pickModalRef={modalA11y.pickModalRef}
					pickSearchInputRef={repoPicker.pickSearchInputRef}
					pickSearch={repoPicker.pickSearch}
					pickSelected={repoPicker.pickSelected}
					filteredPickList={repoPicker.filteredPickList}
					busy={busy}
					onPickSearchChange={repoPicker.setPickSearch}
					onPickSelected={repoPicker.setPickSelected}
					onClose={repoPicker.closePickModal}
					onConfirm={() => void repoPicker.confirmPickRepo()}
					onKeyDown={modalA11y.onModalKeyDown}
				/>
			) : null}
		</>
	);
};
