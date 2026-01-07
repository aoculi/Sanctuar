---
name: smart-commit
description: Intelligently commits and pushes git changes using conventional commit messages, automatically grouping files by logical task. Use when committing multiple features, fixes, or changes that should be separated into distinct commits.
allowed-tools: Bash, Read, Grep, Glob
model: sonnet
---

# Smart Commit & Push

## Overview
This Skill analyzes your git changes, groups modified files by logical task or feature, creates separate conventional commits for each group, and pushes everything to the remote repository.

## Instructions

When invoked, follow these steps:

### 1. Analyze Current Changes
- Run `git status` to see all modified, staged, and untracked files
- Run `git diff` for unstaged changes
- Run `git diff --staged` for staged changes
- Review the actual code changes to understand what was modified

### 2. Group Files by Logical Task
Analyze the changes and group files into logical tasks based on:
- **Related functionality**: Files that work together for a single feature
- **File paths**: Changes in the same directory/module often belong together
- **Change purpose**: Bug fixes vs new features vs refactoring vs docs
- **Dependencies**: Files that depend on each other should be committed together

Examples of logical groupings:
- All files related to a new authentication feature
- Bug fix in a specific component and its tests
- Refactoring of a particular module
- Documentation updates
- Configuration changes

### 3. Generate Conventional Commit Messages
For each group, create a commit message following the Conventional Commits specification:

**Format**: `<type>(<scope>): <description>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only changes
- `style`: Changes that don't affect code meaning (whitespace, formatting)
- `test`: Adding or updating tests
- `chore`: Changes to build process, dependencies, or auxiliary tools
- `perf`: Performance improvements
- `ci`: CI/CD configuration changes
- `revert`: Reverts a previous commit

**Scope** (optional): The part of codebase affected (e.g., `auth`, `api`, `ui`, `bookmarks`)

**Description**:
- Use imperative mood ("add" not "added" or "adds")
- Don't capitalize first letter
- No period at the end
- Be concise but descriptive

**Examples**:
- `feat(bookmarks): add export to JSON functionality`
- `fix(collections): resolve filtering issue in collection list`
- `refactor(utils): simplify collection utility functions`
- `docs(readme): update installation instructions`

### 4. Create Commits
For each logical group:
1. Stage only the files for that group: `git add <file1> <file2> ...`
2. Create the commit with the generated conventional commit message:
```bash
git commit -m "<type>(<scope>): <description>"
```
3. Repeat for each group

**IMPORTANT**: Do NOT add any "Generated with Claude Code" or "Co-Authored-By" footers to commit messages. Keep them clean and follow only the Conventional Commits specification.

### 5. Push Changes
- After all commits are created, push to remote: `git push`
- If the branch doesn't have an upstream, use: `git push -u origin <branch-name>`

## Important Notes

- **NEVER** commit files that likely contain secrets (.env, credentials.json, etc.)
- **DO NOT** skip git hooks (--no-verify) unless explicitly requested
- **DO NOT** force push unless explicitly requested
- **ANALYZE** the actual code changes, don't just rely on file names
- **ASK** the user if you're unsure about how to group changes
- If there's only one logical task, create only one commit
- If files are already staged, respect that staging unless changes clearly belong to different tasks

## Example Workflow

**Scenario**: Modified files include:
- `src/auth/login.ts` (new OAuth flow)
- `src/auth/logout.ts` (new logout endpoint)
- `src/components/Header.tsx` (added logout button)
- `src/utils/api.ts` (fixed timeout bug)
- `README.md` (updated docs)

**Grouping**:
1. **Authentication feature** (3 files): login.ts, logout.ts, Header.tsx
2. **API bug fix** (1 file): api.ts
3. **Documentation** (1 file): README.md

**Commits**:
```bash
# Group 1: Auth feature
git add src/auth/login.ts src/auth/logout.ts src/components/Header.tsx
git commit -m "feat(auth): add OAuth login flow and logout functionality"

# Group 2: API fix
git add src/utils/api.ts
git commit -m "fix(api): resolve timeout issue in request handler"

# Group 3: Docs
git add README.md
git commit -m "docs(readme): update authentication documentation"

# Push all
git push
```

## Edge Cases

- **No changes**: If there are no changes to commit, inform the user
- **Merge conflicts**: If there are unresolved conflicts, warn the user and don't commit
- **Untracked files**: Ask user if untracked files should be included
- **Large commits**: If a group has >10 files, verify with user before committing
- **Mixed changes in one file**: If one file has changes for multiple purposes, you may need to ask user how to handle it

## Success Criteria

- Each commit represents a single logical change
- Commit messages follow Conventional Commits specification
- All commits are pushed successfully
- No secrets or sensitive files are committed
- User can easily understand what each commit does from its message
