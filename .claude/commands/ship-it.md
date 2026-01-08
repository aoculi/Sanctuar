---
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*)
argument-hint: [optional message]
description: Intelligently commit and push changes using conventional commit messages
---

# Ship It

Intelligently commit and push changes using conventional commit messages, automatically grouping files by logical task.

## Instructions

1. Check current git status to see what files have changed
2. Review the diff to understand what changed
3. Group changed files by logical task or feature
4. Create appropriate conventional commit messages for each group
5. Stage and commit each group separately
6. Push all commits to the remote

Follow these conventions:
- Use format: `type(scope): description`
- Types: feat, fix, refactor, docs, test, style, chore, perf
- Keep descriptions under 50 characters
- Use imperative mood (e.g., "add" not "added")

If a message argument is provided, use it for a single commit message instead of grouping.
