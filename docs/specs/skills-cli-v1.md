# Skills CLI v1 Specification

## 1. Product goal

A lightweight CLI called `skills` that manages a local library of [Agent Skills](https://agentskills.io) and installs them into project or global scopes for use by any compatible coding agent.

The CLI has two jobs:

1. **Acquire**: Collect skills from various sources (git repos, local directories) into a local store.
2. **Install**: Symlink or copy skills from the store into `.agents/skills/` (the cross-client standard) and optionally into tool-specific directories.

## 2. Non-goals for v1

- No npm/registry as a skill source (git + local only)
- No manifest-driven desired-state sync
- No semantic versioning
- No multi-user/team policy layer
- No eval harness (design should leave room for it)
- No skill authoring/scaffolding (use your editor + git)

## 3. Tech stack

| Choice | Rationale |
|---|---|
| TypeScript + Node (ESM) | Stable CLI runtime, clean filesystem/subprocess handling |
| [Effect CLI](https://www.effect.solutions/cli) | Typed argument parsing, help generation, Effect ecosystem |
| [Effect Schema](https://effect.website/docs/schema/introduction) | Config and metadata validation |
| [gray-matter](https://github.com/jonschlinkert/gray-matter) | SKILL.md frontmatter parsing |
| [picocolors](https://github.com/alexeyraspopov/picocolors) | Terminal colors (zero deps, tiny) |
| Node built-in `node:child_process` | Git subprocess execution |
| Node built-in `node:fs` | Filesystem operations |
| [vitest](https://vitest.dev) | Testing |
| Node >= 22 (LTS) | Runtime target |

## 4. Core mental model

```
┌─────────────────────┐      ┌──────────────┐      ┌─────────────────────────┐
│   Sources            │      │   Store       │      │   Install targets       │
│                      │      │              │      │                         │
│ git repos            │─add─▶│ flat dir of  │─inst─▶│ .agents/skills/         │
│ local directories    │      │ skill folders │      │ .<tool>/skills/ (opt)   │
│                      │      │              │      │                         │
└─────────────────────┘      └──────────────┘      └─────────────────────────┘
```

### A. Store

A flat directory of skill folders at `~/.config/skills-cli/store/`. Each skill is a directory containing a `SKILL.md`. Skills are acquired from various sources and tracked in a registry file.

```
~/.config/skills-cli/
  config.json         # CLI configuration
  registry.json       # Provenance tracking for store skills
  store/
    debug-logs/
      SKILL.md
      references/
    create-skill/
      SKILL.md
    vercel-v0-skill/
      SKILL.md
  cache/
    <hash>/           # Cached git clones (for pull/update)
```

The store is the single source of truth for what skills are **available**. Skill names are unique within the store — enforced at add time.

### B. Install targets

The directories that coding agents actually read. Following the [agentskills.io client implementation guide](https://agentskills.io/client-implementation/adding-skills-support):

| Scope | Path | Purpose |
|---|---|---|
| Project | `<project>/.agents/skills/` | Cross-client standard (always used) |
| Global | `~/.agents/skills/` | Cross-client standard (always used) |
| Project (tool) | `<project>/.<tool>/skills/` | Tool-specific (optional, via `--tool`) |
| Global (tool) | `~/.<tool>/skills/` | Tool-specific (optional, via `--tool`) |

**Default scope is `--project`.** The `--tool` flag is optional and causes the CLI to additionally symlink into the tool-specific directory (e.g., `.claude/skills/`) pointing at the `.agents/skills/` install.

### C. The CLI

The CLI manages the store and creates symlinks (or copies) from the store into install targets.

## 5. Symlink vs copy

Default: **symlink**.

| Mode | Behavior |
|---|---|
| `symlink` (default) | Install creates a symlink from target dir to store skill dir. Edits in store propagate immediately. |
| `copy` (`--mode copy`) | Install copies the skill directory. Edits in store do not propagate until reinstalled. |

When `--tool` is specified, the tool-specific directory gets a symlink pointing to the `.agents/skills/` install (not directly to the store), keeping one canonical install location.

## 6. CLI commands

```
skills add <source> [--skill <name>] [--name <alias>]
skills remove-source <name>
skills list
skills install <name> [--project|--global] [--tool <tool>] [--mode symlink|copy] [--force]
skills uninstall <name> [--project|--global] [--tool <tool>]
skills pull [<name>]
skills doctor
skills where <name>
```

## 7. Command behavior spec

### `skills add <source>`

**Purpose**: Acquire skills from a source into the local store.

**Arguments**:
- `source` (required): A git URL, GitHub shorthand (`owner/repo`), or local path.

**Options**:
- `--skill <name>`: Add only a specific skill from a multi-skill source. May be specified multiple times for batch add.
- `--name <alias>`: Override the skill name when adding a single skill (for collision avoidance).
- `--force`: Overwrite existing skills in the store with the same name.

**Behavior**:

1. Determine source type:
   - If `source` starts with `git@`, `https://`, or matches `owner/repo` → **git source**
   - If `source` is a local path → **local source**
2. For git sources:
   - Clone repo into `~/.config/skills-cli/cache/<hash>/` (or pull if already cached)
   - Scan for skill directories (immediate children containing `SKILL.md`)
3. For local sources:
   - Validate the path exists and contains `SKILL.md` (single skill) or contains child directories with `SKILL.md` (multi-skill directory)
4. If `--skill` specified, filter to only those skills
5. For each skill to add:
   - Validate `SKILL.md` has valid frontmatter per agentskills.io spec
   - Validate `name` field matches directory name
   - If skill with same name exists in store and no `--force`, **error**
   - Copy skill directory into `~/.config/skills-cli/store/<name>/`
6. Update `registry.json` with provenance for each added skill
7. Print summary of added skills

**First run**: If `~/.config/skills-cli/` doesn't exist, create it along with `store/`, `cache/`, `config.json`, and `registry.json`.

**Examples**:
```bash
# Add all skills from a git repo
skills add git@github.com:andrew/skills-repo.git

# Add from GitHub shorthand
skills add vercel-labs/agent-skills

# Add a specific skill from a repo
skills add vercel-labs/agent-skills --skill v0-skill

# Add multiple specific skills
skills add andrew/skills-repo --skill debug-logs --skill create-skill

# Add a locally created skill
skills add ./my-new-skill

# Add with name override to avoid collision
skills add vercel-labs/agent-skills --skill v0-skill --name vercel-v0

# Overwrite existing
skills add andrew/skills-repo --skill debug-logs --force
```

### `skills remove-source <name>`

**Purpose**: Remove a skill from the store.

**Arguments**:
- `name` (required): Skill name.

**Options**:
- `--force`: Skip confirmation prompt.

**Behavior**:

1. Verify skill exists in store
2. Check if skill is currently installed anywhere (project or global). If so, warn and require `--force` or confirmation.
3. Remove `~/.config/skills-cli/store/<name>/`
4. Remove entry from `registry.json`
5. Clean up cached git repo if no other skills reference it

### `skills list`

**Purpose**: Show all available skills in the store, with install status for the current context.

**Behavior**:

1. Scan store for all skills
2. For each skill, check install status:
   - Global: `~/.agents/skills/<name>/` exists?
   - Project: `<project-root>/.agents/skills/<name>/` exists? (if in a project)
3. Parse `description` from each `SKILL.md` frontmatter
4. Print formatted list

**Output example**:
```
Available skills (3 in store)

  create-skill
    Scaffold or revise an Agent Skill with clear metadata and narrow scope.
    ✓ global    · project

  debug-logs
    Triage logs and identify likely root causes before changing code.
    · global    ✓ project

  vercel-v0
    Generate UI components using v0 patterns.
    · global    · project

✓ = installed  · = not installed
```

### `skills install <name>`

**Purpose**: Install a skill from the store into a project or global scope.

**Arguments**:
- `name` (required): Skill name (must exist in store).

**Options**:
- `--project` (default): Install into the current project's `.agents/skills/`.
- `--global`: Install into `~/.agents/skills/`.
- `--tool <tool>`: Additionally symlink into the tool-specific directory (e.g., `claude`, `codex`, `cursor`).
- `--mode symlink|copy`: Override default install mode. Default: `symlink`.
- `--force`: Overwrite existing install.

**Behavior**:

1. Verify skill exists in store
2. Validate store skill has valid `SKILL.md`
3. Resolve target directory:
   - Project: `<project-root>/.agents/skills/<name>/`
   - Global: `~/.agents/skills/<name>/`
4. If target already exists and no `--force`, **error**
5. Create target parent directory if needed
6. If `--project` and `.agents/skills/` doesn't already exist in the project, **warn and confirm** ("No .agents/skills/ directory found in this project. Create it?")
7. Create symlink or copy from store to target
8. If `--tool` specified:
   - Resolve tool-specific target (e.g., `<project-root>/.claude/skills/<name>/`)
   - Create symlink from tool-specific target → `.agents/skills/<name>/` install
9. Print installed path(s)

**Project root detection**: Walk up from cwd looking for `.git/`. If not found, warn that we're not in a git repository and confirm before proceeding.

**Examples**:
```bash
# Install to current project (default)
skills install debug-logs

# Install globally
skills install debug-logs --global

# Install to project + Claude Code
skills install debug-logs --tool claude

# Install with copy mode
skills install debug-logs --mode copy

# Force overwrite
skills install debug-logs --force
```

**Output example**:
```
Installed debug-logs
  Store:   ~/.config/skills-cli/store/debug-logs
  Target:  ~/work/my-project/.agents/skills/debug-logs (symlink)
  Claude:  ~/work/my-project/.claude/skills/debug-logs → .agents/skills/debug-logs
```

### `skills uninstall <name>`

**Purpose**: Remove an installed skill from a target scope. Does not affect the store.

**Arguments**:
- `name` (required): Skill name.

**Options**:
- `--project` (default): Remove from project scope.
- `--global`: Remove from global scope.
- `--tool <tool>`: Also remove the tool-specific symlink.

**Behavior**:

1. Resolve target path
2. Verify target exists
3. Remove symlink or directory
4. If `--tool` specified, also remove tool-specific symlink
5. Print confirmation

### `skills pull [<name>]`

**Purpose**: Update skills in the store from their original sources.

**Arguments**:
- `name` (optional): Update a specific skill. If omitted, update all git-sourced skills.

**Behavior**:

1. Read `registry.json` for provenance info
2. For each skill to update:
   - If source type is `git`:
     - Run `git -C <cache-path> pull`
     - Re-copy skill from cache to store (overwrite)
     - Print what changed (if anything)
   - If source type is `local`:
     - Warn: "local skill <name> has no remote source, skipping"
3. Print summary
4. Remind: "Symlinked installs are up to date. Copy-mode installs need reinstall."

**Error handling**: If the cached git repo has issues, re-clone from the stored URL.

### `skills doctor`

**Purpose**: Validate the store and all install targets.

**Checks**:

| Check | Severity |
|---|---|
| Store directory exists and is readable | Error |
| Every store skill has valid `SKILL.md` | Error |
| Every store skill has `name` matching directory name | Warning |
| Every store skill has non-empty `description` | Warning |
| `description` is very short (< 20 chars) | Warning |
| Every installed symlink resolves to a real path | Error |
| Copied installs still contain `SKILL.md` | Error |
| Same skill installed both globally and in project | Warning |
| Git cache repos are valid | Warning |
| Registry entries have matching store directories | Warning |

**Output example**:
```
Store: OK (12 skills)

Installed (project: ~/work/my-project):
  .agents/skills:  3 installed, all OK
  .claude/skills:  1 installed, all OK

Installed (global):
  ~/.agents/skills: 2 installed, all OK

Warnings:
  - debug-logs: description is very short, consider adding keywords for agent activation
  - create-skill: installed both globally and in project (project takes precedence)
```

### `skills where <name>`

**Purpose**: Show everywhere a skill exists — store, global, project.

**Arguments**:
- `name` (required): Skill name.

**Output example**:
```
debug-logs

  Store:    ~/.config/skills-cli/store/debug-logs
  Source:   git@github.com:andrew/skills-repo.git (debug-logs)

  Global:
    .agents   ~/.agents/skills/debug-logs → symlink
    .claude   not installed

  Project (~/work/my-project):
    .agents   .agents/skills/debug-logs → symlink
    .claude   .claude/skills/debug-logs → .agents/skills/debug-logs
```

## 8. Config spec

**Path**: `~/.config/skills-cli/config.json`

```json
{
  "defaultScope": "project",
  "defaultMode": "symlink",
  "tools": {
    "claude": {
      "global": "~/.claude/skills",
      "project": ".<tool>/skills"
    },
    "codex": {
      "global": "~/.codex/skills",
      "project": ".<tool>/skills"
    },
    "cursor": {
      "global": "~/.cursor/skills",
      "project": ".<tool>/skills"
    }
  }
}
```

**Rules**:
- `~` is expanded to home directory
- Project paths are relative to the detected project root (nearest `.git/`)
- `tools` map is extensible — users can add tool entries
- All fields have defaults; config file is optional until first `skills add`

**Validated with Effect Schema.**

## 9. Registry spec

**Path**: `~/.config/skills-cli/registry.json`

Tracks provenance for every skill in the store.

```json
{
  "skills": {
    "debug-logs": {
      "source": {
        "type": "git",
        "url": "git@github.com:andrew/skills-repo.git",
        "skill_path": "debug-logs",
        "ref": "main"
      },
      "cache_key": "a1b2c3d4",
      "added_at": "2026-03-10T12:00:00Z",
      "updated_at": "2026-03-15T09:30:00Z"
    },
    "my-local-skill": {
      "source": {
        "type": "local",
        "path": "/Users/andrew/projects/my-local-skill"
      },
      "added_at": "2026-03-12T14:00:00Z",
      "updated_at": "2026-03-12T14:00:00Z"
    }
  }
}
```

**`cache_key`**: A hash of the git URL, used to locate the cached clone at `~/.config/skills-cli/cache/<cache_key>/`.

## 10. Skill format (agentskills.io spec)

The CLI validates skills against the [agentskills.io specification](https://agentskills.io/specification).

### Required structure

```
<skill-name>/
  SKILL.md            # Required
  scripts/            # Optional
  references/         # Optional
  assets/             # Optional
```

### SKILL.md format

YAML frontmatter + Markdown body.

**Required fields**:

| Field | Constraints |
|---|---|
| `name` | 1–64 chars. Lowercase `a-z`, digits, hyphens. No leading/trailing/consecutive hyphens. Must match parent directory name. |
| `description` | 1–1024 chars. Non-empty. Describes what the skill does and when to use it. |

**Optional fields**:

| Field | Constraints |
|---|---|
| `license` | License name or reference |
| `compatibility` | 1–500 chars. Environment requirements. |
| `metadata` | Arbitrary key-value map (string → string) |
| `allowed-tools` | Space-delimited tool list (experimental) |

### Validation behavior

The CLI validates leniently following the agentskills.io client implementation guidance:
- Name doesn't match directory → warn, still add
- Name exceeds 64 chars → warn, still add
- Description missing/empty → **reject** (description is essential for agent activation)
- Unparseable YAML → **reject**

## 11. Internal architecture

```
skills-cli/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    cli.ts                  # Entry point, Effect CLI command tree
    commands/
      add.ts                # skills add
      remove-source.ts      # skills remove-source
      list.ts               # skills list
      install.ts            # skills install
      uninstall.ts          # skills uninstall
      pull.ts               # skills pull
      doctor.ts             # skills doctor
      where.ts              # skills where
    lib/
      config.ts             # Load/save config, expand ~, Effect Schema
      registry.ts           # Load/save registry, provenance tracking
      store.ts              # Store operations (add, remove, enumerate skills)
      installer.ts          # Symlink/copy from store to targets
      git.ts                # Git helpers (clone, pull, status) via child_process
      skill.ts              # Parse SKILL.md, validate frontmatter, enumerate
      paths.ts              # Resolve project root, target dirs, normalize paths
      output.ts             # Formatted console output, colors, tables
    schemas/
      config.schema.ts      # Effect Schema for config.json
      registry.schema.ts    # Effect Schema for registry.json
      skill.schema.ts       # Effect Schema for SKILL.md frontmatter
```

### Module responsibilities

**`cli.ts`** — Effect CLI entry point. Defines the command tree with `Command.make` and `Command.withSubcommands`. Dispatches to command handlers.

**`config.ts`** — Loads `config.json` from `~/.config/skills-cli/`. Returns defaults if file doesn't exist. Validates with Effect Schema. Handles `~` expansion.

**`registry.ts`** — Loads/saves `registry.json`. Tracks provenance per skill. Provides lookup by name, add, remove, update timestamps.

**`store.ts`** — Manages `~/.config/skills-cli/store/`. Enumerates skills, adds skills from source directories, removes skills. Calls `skill.ts` for validation.

**`installer.ts`** — Creates/removes symlinks and copies. Handles the two-tier install: `.agents/skills/` (canonical) + optional tool-specific symlink. Detects existing installs. Resolves project vs global scope.

**`git.ts`** — Thin wrapper around `node:child_process.spawn`. Provides `clone`, `pull`, `isRepo`, `hasUncommittedChanges`. Returns typed results. Used for both source fetching and cache management.

**`skill.ts`** — Parses `SKILL.md` with `gray-matter`. Validates frontmatter fields against agentskills.io spec using Effect Schema. Returns structured skill metadata. Scans a directory for skill subdirectories.

**`paths.ts`** — Resolves project root (walk up for `.git/`). Builds target paths from scope + tool config. Normalizes cross-platform paths. Expands `~`.

**`output.ts`** — Formats terminal output. Skill lists, install confirmations, doctor reports, warnings, errors. Uses `picocolors`.

## 12. package.json

```json
{
  "name": "@anthropic/skills-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "skills": "./dist/cli.js"
  },
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx src/cli.ts",
    "test": "vitest",
    "lint": "eslint ."
  },
  "dependencies": {
    "@effect/cli": "...",
    "@effect/platform": "...",
    "@effect/platform-node": "...",
    "effect": "...",
    "gray-matter": "...",
    "picocolors": "..."
  },
  "devDependencies": {
    "typescript": "...",
    "tsx": "...",
    "vitest": "...",
    "eslint": "..."
  }
}
```

## 13. Error handling

### Hard errors (exit non-zero)

| Condition | Message |
|---|---|
| Store doesn't exist and can't be created | `Cannot create store at ~/.config/skills-cli/store/` |
| Skill not found in store | `Skill "<name>" not found in store. Run "skills list" to see available skills.` |
| Skill already exists in store (no `--force`) | `Skill "<name>" already exists in store. Use --force to overwrite.` |
| Target already exists (no `--force`) | `Skill "<name>" already installed at <path>. Use --force to overwrite.` |
| Source skill missing `SKILL.md` | `No SKILL.md found in <path>. Not a valid skill.` |
| Source skill has empty/missing description | `Skill "<name>" has no description. A description is required for agent activation.` |
| Git clone/pull fails | `Git operation failed: <stderr>` |
| Source repo has uncommitted changes (on pull) | `Source repo at <path> has uncommitted changes. Resolve manually and retry.` |

### Warnings (non-fatal)

| Condition | Message |
|---|---|
| Name doesn't match directory | `Warning: name "<name>" doesn't match directory "<dir>". Using directory name.` |
| Description < 20 chars | `Warning: description for "<name>" is very short. Longer descriptions improve agent activation.` |
| Installed both globally and in project | `Warning: "<name>" is installed globally and in project. Project takes precedence.` |
| Copy-mode install may be stale after pull | `Note: "<name>" was installed with copy mode. Reinstall to get updates.` |
| Not in a git repo (for --project) | `Warning: not in a git repository. Skill will be installed relative to cwd.` |
| No .agents/skills/ in project yet | `No .agents/skills/ directory in this project. Create it? (y/n)` |

## 14. Lifecycle walkthrough

### Phase 1: Bootstrap

```bash
# First command bootstraps everything
skills add git@github.com:andrew/skills-repo.git
```

Creates `~/.config/skills-cli/` with all subdirectories. Clones the repo. Copies all skills into the store. Writes `registry.json` with provenance.

```
Added 5 skills from git@github.com:andrew/skills-repo.git

  create-skill       Scaffold or revise an Agent Skill with clear metadata.
  debug-logs         Triage logs and identify likely root causes.
  write-migration    Produce a safe DB migration plan before coding.
  research-design    Research implementation options and propose a design.
  code-review        Review code for correctness, clarity, and security.
```

### Phase 2: Add more sources

```bash
# Add skills from Vercel's public repo
skills add vercel-labs/agent-skills --skill v0-skill

# Add a skill you created locally
skills add ~/projects/my-custom-skill
```

### Phase 3: See what's available

```bash
skills list
```

```
Available skills (7 in store)

  code-review        Review code for correctness, clarity, and security.
                     · global    · project

  create-skill       Scaffold or revise an Agent Skill.
                     · global    · project

  debug-logs         Triage logs and identify likely root causes.
                     · global    · project

  my-custom-skill    Custom workflow for internal tooling.
                     · global    · project

  research-design    Research implementation options.
                     · global    · project

  v0-skill           Generate UI components using v0 patterns.
                     · global    · project

  write-migration    Produce a safe DB migration plan.
                     · global    · project
```

### Phase 4: Install skills

```bash
cd ~/work/patient-billing

# Install to project (default)
skills install write-migration
skills install debug-logs

# Install globally
skills install create-skill --global
skills install code-review --global

# Install with Claude Code support
skills install debug-logs --tool claude
```

### Phase 5: Check install state

```bash
skills list
```

```
Available skills (7 in store)

  code-review        Review code for correctness, clarity, and security.
                     ✓ global    · project

  create-skill       Scaffold or revise an Agent Skill.
                     ✓ global    · project

  debug-logs         Triage logs and identify likely root causes.
                     · global    ✓ project

  ...
```

### Phase 6: Inspect a specific skill

```bash
skills where debug-logs
```

```
debug-logs

  Store:    ~/.config/skills-cli/store/debug-logs
  Source:   git@github.com:andrew/skills-repo.git (debug-logs)

  Global:
    .agents   not installed

  Project (~/work/patient-billing):
    .agents   .agents/skills/debug-logs → symlink
    .claude   .claude/skills/debug-logs → .agents/skills/debug-logs
```

### Phase 7: Update from sources

```bash
skills pull
```

```
Pulling 6 git-sourced skills...

  create-skill       ✓ updated
  debug-logs         · no changes
  write-migration    · no changes
  research-design    ✓ updated
  code-review        · no changes
  v0-skill           ✓ updated

Skipping 1 local skill (my-custom-skill)

Symlinked installs are up to date. Copy-mode installs need reinstall.
```

### Phase 8: Validate

```bash
skills doctor
```

```
Store: OK (7 skills)

Installed (project: ~/work/patient-billing):
  .agents/skills:  2 installed, all OK
  .claude/skills:  1 installed, OK

Installed (global):
  ~/.agents/skills: 2 installed, all OK

Warnings:
  - my-custom-skill: description is very short (12 chars)
  - create-skill: installed globally and in project (project takes precedence)
```

### Phase 9: Uninstall and clean up

```bash
# Remove from project
skills uninstall debug-logs

# Remove from store entirely
skills remove-source debug-logs
```

## 15. Implementation order

### Milestone 1: Foundation
- Project setup (package.json, tsconfig, Effect CLI scaffold)
- `config.ts`, `registry.ts`, `paths.ts` with Effect Schema validation
- `skill.ts` (SKILL.md parsing + validation)
- `store.ts` (enumerate, add, remove)

### Milestone 2: Acquire
- `git.ts` (clone, pull, status)
- `skills add` command (git + local sources)
- `skills remove-source` command
- `skills list` command (store only, no install status yet)

### Milestone 3: Install
- `installer.ts` (symlink, copy, remove)
- `skills install` command
- `skills uninstall` command
- `skills list` with install status

### Milestone 4: Maintain
- `skills pull` command
- `skills where` command
- `skills doctor` command

### Milestone 5: Polish
- `--force` flag coverage
- Better error messages
- `--json` output mode
- Comprehensive tests

## 16. Testing strategy

### Unit tests

- Config parsing + defaults + `~` expansion
- Registry CRUD operations
- SKILL.md frontmatter parsing (valid, invalid, edge cases)
- Skill name validation (per agentskills.io rules)
- Path resolution (project root detection, target path building)
- Git URL / GitHub shorthand parsing

### Integration tests

- `skills add` with a temp git repo
- `skills add` with a local directory
- `skills install` / `skills uninstall` symlink lifecycle
- `skills install` / `skills uninstall` copy mode
- `skills install --tool` two-tier symlink
- `skills pull` updates cached repo and store
- `skills doctor` detects broken symlinks
- `skills doctor` detects missing SKILL.md
- `skills where` output across scopes
- `skills list` install status detection

### Test infrastructure

- Use temp directories for store, cache, and install targets
- Create minimal git repos in test setup
- Mock nothing — test against real filesystem and real git

## 17. Defaults

| Setting | Default |
|---|---|
| Scope | `--project` |
| Install mode | `symlink` |
| Config path | `~/.config/skills-cli/config.json` |
| Store path | `~/.config/skills-cli/store/` |
| Cache path | `~/.config/skills-cli/cache/` |
| Install target | `.agents/skills/` |
| Tool-specific target | `.<tool>/skills/` |
