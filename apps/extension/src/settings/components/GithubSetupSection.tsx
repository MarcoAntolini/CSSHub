import type { ReactElement } from "react";
import type { AuthStatus, Branch, ExtensionSettings, Repo } from "@/shared/contracts";
import type { UiNotice } from "@/settings/types";
import { AuthSection } from "./AuthSection";
import { RepositorySection } from "./RepositorySection";

type DeviceFlowState = {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string | null;
	interval: number;
} | null;

type GithubSetupSectionProps = {
	auth: AuthStatus;
	settings: ExtensionSettings;
	selectedRepoMeta: Repo | null;
	branches: Branch[];
	branchesLoading: boolean;
	createBranchName: string;
	createBranchFrom: string;
	readmeInfoOpen: boolean;
	busy: boolean;
	webAuthInProgress: boolean;
	deviceFlow: DeviceFlowState;
	deviceCopyOk: boolean;
	onBeginWebFlow: () => void;
	onBeginDeviceFlow: () => void;
	onPollDevice: () => void;
	onCopyDeviceUserCode: () => void;
	onOpenDeviceVerification: () => void;
	onLogout: () => void;
	onLoginPat: (token: string) => Promise<boolean>;
	pushToast: (payload: UiNotice) => void;
	onCreateBranchNameChange: (value: string) => void;
	onCreateBranchFromChange: (value: string) => void;
	onReadmeInfoOpenChange: (open: boolean) => void;
	onOpenPickModal: () => void;
	onClearRepoSelection: () => void;
	onOpenCreateModal: () => void;
	onSaveSettings: (next: ExtensionSettings) => void;
	onConfirmCreateBranch: () => void;
};

export const githubSetupSummary = (
	auth: AuthStatus,
	settings: ExtensionSettings
): string => {
	if (!auth.isAuthenticated) {
		return "Connect to sync submissions";
	}
	const account = auth.username ? `Signed in as ${auth.username}` : "Signed in to GitHub";
	const repo = settings.selectedRepoFullName ?? "No repository selected";
	return `${account} · ${repo}`;
};

export const githubSetupTitle = (auth: AuthStatus): string =>
	auth.isAuthenticated ? "GitHub & repository" : "Connect GitHub";

export const GithubSetupSection = ({
	auth,
	settings,
	selectedRepoMeta,
	branches,
	branchesLoading,
	createBranchName,
	createBranchFrom,
	readmeInfoOpen,
	busy,
	webAuthInProgress,
	deviceFlow,
	deviceCopyOk,
	onBeginWebFlow,
	onBeginDeviceFlow,
	onPollDevice,
	onCopyDeviceUserCode,
	onOpenDeviceVerification,
	onLogout,
	onLoginPat,
	pushToast,
	onCreateBranchNameChange,
	onCreateBranchFromChange,
	onReadmeInfoOpenChange,
	onOpenPickModal,
	onClearRepoSelection,
	onOpenCreateModal,
	onSaveSettings,
	onConfirmCreateBranch,
}: GithubSetupSectionProps): ReactElement => {
	if (!auth.isAuthenticated) {
		return (
			<AuthSection
				auth={auth}
				busy={busy}
				webAuthInProgress={webAuthInProgress}
				deviceFlow={deviceFlow}
				deviceCopyOk={deviceCopyOk}
				onBeginWebFlow={onBeginWebFlow}
				onBeginDeviceFlow={onBeginDeviceFlow}
				onPollDevice={onPollDevice}
				onCopyDeviceUserCode={onCopyDeviceUserCode}
				onOpenDeviceVerification={onOpenDeviceVerification}
				onLogout={onLogout}
				onLoginPat={onLoginPat}
				pushToast={pushToast}
			/>
		);
	}

	return (
		<>
			<div className="settings-subsection">
				<h3 className="settings-subsection-title">Account</h3>
				<AuthSection
					auth={auth}
					busy={busy}
					webAuthInProgress={webAuthInProgress}
					deviceFlow={deviceFlow}
					deviceCopyOk={deviceCopyOk}
					onBeginWebFlow={onBeginWebFlow}
					onBeginDeviceFlow={onBeginDeviceFlow}
					onPollDevice={onPollDevice}
					onCopyDeviceUserCode={onCopyDeviceUserCode}
					onOpenDeviceVerification={onOpenDeviceVerification}
					onLogout={onLogout}
					onLoginPat={onLoginPat}
					pushToast={pushToast}
				/>
			</div>
			<div className="settings-subsection">
				<h3 className="settings-subsection-title">Repository</h3>
				<RepositorySection
					settings={settings}
					selectedRepoMeta={selectedRepoMeta}
					branches={branches}
					branchesLoading={branchesLoading}
					createBranchName={createBranchName}
					createBranchFrom={createBranchFrom}
					readmeInfoOpen={readmeInfoOpen}
					busy={busy}
					onCreateBranchNameChange={onCreateBranchNameChange}
					onCreateBranchFromChange={onCreateBranchFromChange}
					onReadmeInfoOpenChange={onReadmeInfoOpenChange}
					onOpenPickModal={onOpenPickModal}
					onClearRepoSelection={onClearRepoSelection}
					onOpenCreateModal={onOpenCreateModal}
					onSaveSettings={onSaveSettings}
					onConfirmCreateBranch={onConfirmCreateBranch}
				/>
			</div>
		</>
	);
};
