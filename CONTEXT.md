# CssHub

CssHub helps CSSBattle players preserve their work by syncing the solutions they create on CSSBattle into a GitHub repository they choose. This context captures the product language used across the extension, backend, docs, and saved GitHub archive.

## Language

**Target**:
A playable CSSBattle unit that asks the player to recreate a visual shape with code. Targets may appear inside a Battle or as a Daily Target.
_Avoid_: Challenge, level

**Battle**:
A CSSBattle collection that groups multiple Targets under a shared theme or sequence.
_Avoid_: Battle group, challenge group

**Daily Target**:
A date-based CSSBattle Target published outside the normal Battle collection flow.
_Avoid_: Daily challenge, daily battle

**Solution**:
The player's code and resulting rendered output for a Target.
_Avoid_: Snippet, answer

**Submission**:
One captured attempt to save a Solution, including the Target identity, score, match percentage, code, and optional images available at that moment.
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

**GitHub Authentication**:
The user's authorization for CssHub to access GitHub on their behalf.
_Avoid_: Login session, token
