---
allowed-tools: Bash(pnpm compile:*)
argument-hint: none
description: Type check the extension TypeScript code for errors
---

# Type Check Extension

Run TypeScript type checking on the browser extension without emitting any files.

## Instructions

1. Navigate to the extension package directory: `packages/extension`
2. Run the type check command: `pnpm compile`
3. Report any type errors found, or confirm successful compilation

## Command

```bash
cd packages/extension && pnpm compile
```

This runs `tsc --noEmit` which checks all TypeScript files for type errors without generating any output files.

## Common Use Cases

- Before committing changes to ensure type safety
- After refactoring to verify all types are correct
- During code review to check for type-related issues
- After adding new dependencies or changing type definitions

## Expected Output

- **Success**: No output (silent success)
- **Failure**: TypeScript errors with file locations and descriptions
