# CssHub

CssHub helps CSSBattle players preserve their work by syncing the solutions they create on CSSBattle into a GitHub repository they choose. This context captures the product language used across the extension, backend, docs, and saved GitHub archive.

## Language

**Target**:
A playable CSSBattle unit that asks the player to recreate a visual shape with code. Targets may appear inside a Battle or as a Daily Target.
_Avoid_: Challenge, level

**Battle**:
A CSSBattle collection that groups multiple Targets under a shared theme or sequence.
_Avoid_: Battle group, challenge group

**Battle Metadata**:
The Battle-level Target total and finished/unfinished status CssHub uses to show Battle progress in the Battle Archive.
_Avoid_: Submission metadata, target metadata

**Daily Target**:
A date-based CSSBattle Target published outside the normal Battle collection flow.
_Avoid_: Daily challenge, daily battle

**Daily Target Progress**:
The saved-over-available count CssHub shows for a calendar month of Daily Targets in the Battle Archive. A month still receiving Daily Targets is marked as unfinished.
_Avoid_: Daily metadata, daily battle progress

**Solution**:
The player's code and resulting rendered output for a Target.
_Avoid_: Snippet, answer

**Submission**:
One captured attempt from a CSSBattle Target play page (`/play/{targetId}`) to save a Solution, including the Target identity, score, match percentage, code, and optional images available at that moment. CssHub does not expect users to submit from Battle overview pages.
_Avoid_: Solution, sync, upload

**Score**:
The CSSBattle points awarded to a Submission.
_Avoid_: Points, rating

**Match Percentage**:
The CSSBattle similarity percentage between the player's rendered Solution and the Target.
_Avoid_: Match, accuracy, threshold

**Character Count**:
The number of characters in the Solution code that CSSBattle counts for scoring and comparison.
_Avoid_: Code size, length

**Accepted Submission**:
A Submission that meets the user's configured score or match threshold. An Accepted Submission may still be uncommitted if required setup is missing or another submission is already better.
_Avoid_: Successful commit, synced submission

**Sync**:
The user-facing act of evaluating a Submission and, when eligible, writing it to the Selected Repository.
_Avoid_: Upload, export

**Commit**:
A GitHub commit created by CssHub to store an eligible Submission in the Selected Repository.
_Avoid_: Sync, save

**Skipped Submission**:
A Submission that CssHub evaluated but intentionally did not commit.
_Avoid_: Failed submission, rejected submission

**Failed Capture Attempt**:
When CssHub cannot read required CSSBattle page data during submit handling, so no Submission is created and Sync never starts. The user should submit again after the page finishes updating or after disabling extensions that modify the page.
_Avoid_: Skipped Submission, sync failure, incomplete submission

**Duplicate Submission**:
A Submission that matches a very recent prior Submission closely enough that CssHub treats it as the same attempt.
_Avoid_: Repeat sync, resubmission

**Selected Repository**:
The user-owned GitHub repository and branch CssHub is configured to write Submissions into.
_Avoid_: Archive repository, sync repository, destination repo

**Battle Archive**:
The organized history of saved Battles, Daily Targets, Submissions, images, and generated README content inside the Selected Repository.
_Avoid_: Backup, export

**Activity Log**:
The user-facing list of recent CssHub outcomes, such as skipped duplicates, accepted submissions, sync failures, and commits.
_Avoid_: Event stream, debug log

**Page Feedback**:
Transient in-page UI on the CSSBattle tab that tells the user what happened during submit handling — processing, committed, skipped, failed capture, or sync error.
_Avoid_: Toast, notification, badge

**Saved Code Format**:
The setting that controls how CssHub writes Solution code into each Target README during Sync. Supported primary formats are Original, Prettified, and Minified.
_Avoid_: Export format, archive transform

**Formatting Controls**:
Optional in-page buttons on the CSSBattle editor that let the player preview or apply prettified or minified code before submitting.
_Avoid_: Auto-format, submit transform

**Setup Badge**:
The persistent extension icon indicator shown when GitHub Authentication or a Selected Repository is missing. It is not used for transient submit outcomes.
_Avoid_: Result badge, sync badge

**GitHub Authentication**:
The user's authorization for CssHub to access GitHub on their behalf.
_Avoid_: Login session, token
