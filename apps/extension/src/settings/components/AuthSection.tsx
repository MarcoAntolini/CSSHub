import type { ReactElement } from "react";
import { useState } from "react";
import type { AuthStatus } from "@/shared/contracts";
import type { UiNotice } from "@/settings/types";

type DeviceFlowState = {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string | null;
	interval: number;
} | null;

type AuthSectionProps = {
	auth: AuthStatus;
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
};

export const AuthSection = ({
	auth,
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
}: AuthSectionProps): ReactElement => {
	const [patToken, setPatToken] = useState("");
	const [patTokenVisible, setPatTokenVisible] = useState(false);
	const [patTutorialOpen, setPatTutorialOpen] = useState(false);
	const profileUrl = auth.username
		? `https://github.com/${encodeURIComponent(auth.username)}`
		: null;

	return (
		<>
			{auth.isAuthenticated ? (
				<>
					<p className="muted">
						Signed in as{" "}
						{profileUrl ? (
							<a
								className="account-link mono"
								href={profileUrl}
								target="_blank"
								rel="noreferrer noopener"
							>
								{auth.username}
							</a>
						) : (
							<strong className="mono">GitHub</strong>
						)}
					</p>
					<div className="btn-stack">
						<button
							type="button"
							className="btn btn-ghost"
							onClick={onLogout}
							disabled={busy}
						>
							Disconnect GitHub
						</button>
					</div>
				</>
			) : (
				<>
					<p className="muted auth-methods-intro">
						Pick any method — they all grant the same access CssHub needs.
					</p>
					<div className="auth-methods" role="list">
						<div className="auth-method-card" role="listitem">
							<div className="auth-method-head">
								<h3 className="auth-method-title">Browser sign-in</h3>
							</div>
							<div className="auth-method-actions">
								<button
									type="button"
									className="btn btn-primary btn-auth-browser"
									onClick={onBeginWebFlow}
									disabled={busy || webAuthInProgress}
									aria-busy={webAuthInProgress}
									aria-label={
										webAuthInProgress ? "Connecting with GitHub" : undefined
									}
								>
									<span
										className={
											webAuthInProgress
												? "btn-auth-browser-label is-busy"
												: "btn-auth-browser-label"
										}
									>
										Continue with GitHub
									</span>
									{webAuthInProgress ? (
										<span
											className="btn-auth-browser-busy"
											aria-hidden="true"
										>
											<span className="btn-spinner" />
										</span>
									) : null}
								</button>
								<p className="hint auth-trust-line" role="note">
									OAuth runs on github.com. This extension never receives your
									GitHub password.
								</p>
							</div>
						</div>

						<div className="auth-method-card" role="listitem">
							<div className="auth-method-head">
								<h3 className="auth-method-title">Device code</h3>
								<p className="auth-method-desc">
									Use when browser OAuth is blocked. We open GitHub with your
									code when GitHub supports it.
								</p>
							</div>
							<div className="auth-method-actions">
								{deviceFlow ? (
									<div className="device-flow">
										<ol className="device-flow-steps">
											<li>
												Complete the prompt in the GitHub tab (we opened one when
												you started).
											</li>
											<li>
												Confirm the user code below matches GitHub if you are
												asked to enter it.
											</li>
											<li>After you authorize CssHub, finish here.</li>
										</ol>
										<p className="device-flow-label">Your user code</p>
										<div className="device-user-code-shell">
											<div
												className="device-user-code-inner"
												translate="no"
												aria-label="GitHub device user code"
											>
												{deviceFlow.userCode.split("-").map((part, i) => (
													<span key={i} className="device-user-code-group">
														{i > 0 ? (
															<span
																className="device-user-code-sep"
																aria-hidden="true"
															>
																-
															</span>
														) : null}
														<span className="device-user-code-chunk">
															{part}
														</span>
													</span>
												))}
											</div>
											<button
												type="button"
												className={`device-copy-icon-btn${deviceCopyOk ? " device-copy-icon-btn--ok" : ""}`}
												onClick={onCopyDeviceUserCode}
												disabled={busy}
												aria-label="Copy user code to clipboard"
												data-tooltip={deviceCopyOk ? "Copied" : "Copy text"}
											>
												<svg
													className="device-copy-icon"
													width="18"
													height="18"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
													aria-hidden="true"
												>
													<rect
														x="9"
														y="9"
														width="13"
														height="13"
														rx="2"
														ry="2"
													/>
													<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
												</svg>
											</button>
										</div>
										<div className="device-flow-link-row">
											<button
												type="button"
												className="device-github-again-link"
												onClick={onOpenDeviceVerification}
												disabled={busy}
											>
												Open GitHub again
											</button>
										</div>
										<button
											type="button"
											className="btn btn-primary device-flow-finish"
											onClick={onPollDevice}
											disabled={busy}
										>
											I authorized CssHub — finish sign-in
										</button>
									</div>
								) : (
									<button
										type="button"
										className="btn"
										onClick={onBeginDeviceFlow}
										disabled={busy || webAuthInProgress}
									>
										Start device sign-in
									</button>
								)}
							</div>
						</div>

						<div className="auth-method-card" role="listitem">
							<div className="auth-method-head">
								<div className="auth-method-title-row">
									<h3 className="auth-method-title">Personal access token</h3>
									<button
										type="button"
										className="help-badge"
										aria-expanded={patTutorialOpen}
										aria-controls="pat-tutorial-panel"
										onClick={() => setPatTutorialOpen((open) => !open)}
										title="How to create a token"
									>
										?
									</button>
								</div>
								<p className="auth-method-desc">
									Paste a classic or fine-grained token. It stays in this browser
									profile only.
								</p>
							</div>
							{patTutorialOpen ? (
								<div
									className="pat-tutorial"
									id="pat-tutorial-panel"
									role="region"
									aria-label="Personal access token instructions"
								>
									<ol>
										<li>
											On GitHub, open{" "}
											<strong>
												Settings → Developer settings → Personal access tokens
											</strong>{" "}
											(classic or fine-grained).
										</li>
										<li>
											<strong>Classic token:</strong> enable scopes{" "}
											<code className="pat-tutorial-code">repo</code> and{" "}
											<code className="pat-tutorial-code">read:user</code> (same
											access as browser sign-in).
										</li>
										<li>
											<strong>Fine-grained token:</strong> pick repositories CssHub
											should sync to and grant <strong>Contents</strong>{" "}
											read/write (and metadata as prompted).
										</li>
										<li>
											Generate the token, copy it once, paste below, then choose
											Sign in with token.
										</li>
									</ol>
								</div>
							) : null}
							<div className="auth-method-actions">
								<div className="row row-tight">
									<label htmlFor="pat-settings">Token</label>
									<div className="pat-input-row">
										<input
											id="pat-settings"
											type={patTokenVisible ? "text" : "password"}
											autoComplete="off"
											placeholder="github_pat_… or ghp_…"
											value={patToken}
											onChange={(e) => setPatToken(e.target.value)}
											disabled={busy || webAuthInProgress}
										/>
										<button
											type="button"
											className="btn btn-ghost pat-visibility-toggle"
											onClick={() => setPatTokenVisible((visible) => !visible)}
											aria-label={
												patTokenVisible
													? "Hide personal access token"
													: "Show personal access token"
											}
											aria-pressed={patTokenVisible}
											disabled={busy || webAuthInProgress}
										>
											{patTokenVisible ? "Hide" : "Show"}
										</button>
									</div>
								</div>
								<button
									type="button"
									className="btn"
									onClick={() => {
										if (!patToken.trim()) {
											pushToast({
												level: "warn",
												message: "Paste a token",
											});
											return;
										}
										void onLoginPat(patToken.trim()).then((ok) => {
											if (ok) {
												setPatToken("");
												setPatTokenVisible(false);
											}
										});
									}}
									disabled={busy || webAuthInProgress}
								>
									Sign in with token
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</>
	);
};
