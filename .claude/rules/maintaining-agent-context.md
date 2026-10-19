---
paths:
    - 'CLAUDE.md'
    - 'AGENTS.md'
    - '.claude/**'
    - '.mcp.json'
---

# Maintaining agent context (.claude/)

> How to keep CLAUDE.md, AGENTS.md and `.claude/` consistent and useful.

## Layout

| Location                | Purpose                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CLAUDE.md`             | Always loaded: imports `AGENTS.md` (`@AGENTS.md`) and adds Claude-specific working rules. Keep short.                                      |
| `AGENTS.md`             | Tool-agnostic orientation for humans and AI contributors (entrypoints, constraints, commands).                                             |
| `.claude/rules/`        | Topical rules. Every rule has `paths` frontmatter, so it loads only when matching files are touched.                                       |
| `.claude/skills/`       | Skills (`<name>/SKILL.md`), loaded on demand or invoked as `/<name>`.                                                                      |
| `.claude/agents/`       | Read-only subagents (`code-reviewer`, `qa-engineer`).                                                                                      |
| `.claude/settings.json` | Shared permissions (allow / ask / deny) and the enabled plugin marketplace. Personal overrides go to the gitignored `settings.local.json`. |
| `.mcp.json`             | Project MCP servers (`chrome-devtools`), pinned to an exact version.                                                                       |

## Rules of thumb

- A new rule needs `paths` frontmatter; only `CLAUDE.md` / `AGENTS.md` are always loaded. Prose such as "Applies to: ..." does not scope anything.
- Write what Claude cannot derive from the code; link to real files instead of copying them. Do not repeat the same fact in several files.
- Requirements that can be enforced (blocked commands, formatting, checks) belong in `.claude/settings.json`, hooks, scripts or CI, not only in prose.
- Skill descriptions are in the third person and say what the skill does and when to use it.
- Remove outdated guidance promptly; stale rules are worse than no rules.

## Keeping things in sync

- When an npm script, manifest key, placeholder or shared API changes, update `README.md`, `AGENTS.md`, the matching rule in `.claude/rules/` and `.claude/skills/verify/SKILL.md` if the checks changed.
- After moving or renaming files, check that every relative link in `CLAUDE.md`, `AGENTS.md` and `.claude/**/*.md` still resolves.
