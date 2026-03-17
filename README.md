# Skills CLI

A lightweight CLI for managing [Agent Skills](https://agentskills.io). Collect skills from git repos or local directories into a local store, then install them into any project for use by Claude Code, Codex, Cursor, or any compatible coding agent.

## Quick start

```bash
# Add skills from a GitHub repo
skills add emilkowalski/skill
skills add vercel-labs/agent-skills --skill react-best-practices

# See what's available
skills list

# Install into your project
cd ~/my-project
skills install react-best-practices --tool claude

# Update from sources
skills pull

# Check health
skills doctor
```

## Commands

| Command | Purpose |
|---|---|
| `skills add <source>` | Add skills from a git repo or local directory |
| `skills remove-source <name>` | Remove a skill from the store |
| `skills list` | List all skills with install status |
| `skills install <name>` | Install a skill into a project or global scope |
| `skills uninstall <name>` | Remove an installed skill |
| `skills pull [<name>]` | Update git-sourced skills |
| `skills where <name>` | Show everywhere a skill is installed |
| `skills doctor` | Validate store and install targets |

## How it works

```
Sources → Store → Install targets

git repos          ~/.config/skills-cli/store/     .agents/skills/ (cross-client)
local dirs                                         .<tool>/skills/ (tool-specific)
```

**Add** clones/copies skills into a central store. **Install** symlinks (or copies) from the store into your project's `.agents/skills/` directory, with an optional tool-specific symlink (e.g., `.claude/skills/`).

### Key flags

- `--skill <name>` — add only specific skills from a multi-skill repo (repeatable)
- `--tool <tool>` — additionally symlink into `.<tool>/skills/`
- `--mode copy` — copy instead of symlink (default: symlink)
- `--global` — install to `~/.agents/skills/` instead of project
- `--force` — overwrite existing

## Development

```bash
pnpm install
pnpm test          # run tests
pnpm run build     # compile to dist/
```

Requires Node >= 22.
