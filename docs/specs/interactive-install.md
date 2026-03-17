# Implementation Plan: Interactive Skill Installer

## Goal
When `skills install` is run without a skill name, launch an interactive multi-select prompt showing all store skills with their install status, letting the user pick multiple skills to install at once. Also prompt for `--tool` if not provided.

## Approach
Use `@clack/prompts` for the interactive UI (multiselect + select). Make the `name` arg optional on the install command — when absent, enter interactive mode. Reuse existing `listSkills`, `checkInstallStatus`, and `installSkill` functions. Wrap clack's async prompts in `Effect.async` or `Effect.promise`.

Chosen over custom raw-stdin (too much code for keyboard/rendering) and @inquirer/prompts (heavier dependency, less aligned with minimal style).

## Phases

### Phase 1: Add `@clack/prompts` dependency
**Changes:**
- `pnpm add @clack/prompts`

**Verification:** `pnpm ls @clack/prompts` shows it installed

### Phase 2: Create interactive prompt helper
**Files:** `src/lib/prompt.ts` (new)
**Changes:**
- Create a `selectSkillsToInstall` function that:
  - Takes the list of store skills and their install statuses
  - Shows a `multiselect` with each skill as an option
  - Label format: skill name + description, with hint showing install status (e.g., "✓ global", "✓ project")
  - Already-installed skills in the target scope show a hint but are still selectable (for reinstall with --force)
  - Returns array of selected skill names
- Create a `selectTool` function that:
  - Shows a `select` with options: claude, codex, cursor, and "none"
  - Returns the tool name or undefined
- Both functions handle cancellation (Ctrl+C) via `isCancel` → `Effect.fail`

**Verification:** Unit-testable in isolation (though prompts are interactive)

### Phase 3: Update install command to support interactive mode
**Files:** `src/commands/install.ts`
**Changes:**
- Make `name` arg optional using `Args.optional` (same pattern as `pull.ts`)
- Update handler: when `name` is `Option.None`:
  1. Load skills from store via `listSkills()`
  2. If store is empty, print message and exit
  3. Resolve project root and check install status for each skill
  4. Call `selectSkillsToInstall()` with skills + statuses
  5. If `--tool` not provided, call `selectTool()`
  6. Loop through selected skills, call `installSkill()` for each
  7. Print summary of what was installed
- When `name` is `Option.Some`: existing behavior unchanged

**Verification:**
- `skills install` (no args) → interactive multi-select appears
- `skills install my-skill` → existing behavior unchanged
- `skills install --global` (no name) → interactive mode with global scope
- Ctrl+C during prompt → clean exit

### Phase 4: Build and manual test
**Changes:**
- `pnpm build` to verify TypeScript compiles
- Manual testing of the interactive flow

**Verification:** Run through the happy path end-to-end

## Success Criteria
- [ ] `skills install` with no name arg launches interactive multi-select
- [ ] Each skill shows name, description, and current install status (global/project)
- [ ] Multiple skills can be selected and installed in one operation
- [ ] `--tool` is prompted interactively when not provided (only in interactive mode)
- [ ] Ctrl+C cleanly exits
- [ ] `skills install <name>` still works exactly as before
- [ ] All existing flags (--global, --force, --mode, --tool) work in interactive mode

## Risks & Mitigations
- `@clack/prompts` rendering in non-TTY environments → check `process.stdin.isTTY` before entering interactive mode, fall back to error message asking for skill name
- Long skill lists may be hard to scroll → clack's multiselect handles scrolling natively; could add `maxItems` if needed
- Effect integration → wrap with `Effect.promise` since clack prompts are async; handle cancel symbol explicitly

## Out of Scope
- Filtering/searching within the interactive list (clack doesn't support it natively)
- Interactive mode for `uninstall` (could be a follow-up)
- Changing the `skills list` command output
