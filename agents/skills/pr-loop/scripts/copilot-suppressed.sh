#!/usr/bin/env bash
# Print the suppressed comments of each Copilot review on a PR, newest review first.
# GitHub opens no review thread for them, so fetch-comments.sh of pr-review-comments does not return them.
# Usage: copilot-suppressed.sh <PR_NUMBER>
set -euo pipefail

PR_NUMBER="${1:?Usage: copilot-suppressed.sh <PR_NUMBER>}"

gh pr view "$PR_NUMBER" --json reviews --jq '
  [.reviews[]
    | select(.author.login | test("copilot"; "i"))
    | select(.body | test("Suppressed comments|Comments suppressed due to low confidence"))]
  | sort_by(.submittedAt) | reverse | .[]
  | "## Copilot review of \(.submittedAt)\n\n"
    + (.body | capture("(?<s>(Suppressed comments|Comments suppressed due to low confidence) \\(\\d+\\)[\\s\\S]*?)(\\n</details>|\\n### |\\n- \\*\\*Files reviewed|$)").s)
    + "\n"'
