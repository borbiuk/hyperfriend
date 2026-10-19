# Claude Code — Hyperfriend

Read **[AGENTS.md](AGENTS.md)** first. It lists entrypoints, MV3 and two-browser constraints, the dependency policy, file ownership, and build commands.

## Working rules

- Follow existing project conventions (code style, folder structure, naming, dependency management) unless explicitly instructed otherwise.
- Never refactor unless explicitly requested; apply only the changes directly required for the current request. Keep changes minimal, explicit, and localized.
- Always use a block `if-return` statement (avoid inline one-liners).
- All comments and documentation must be in English; answer in the same language as the question.
- Dependencies: only exact versions, never `^` or `~`. Install with `npm install -E <package>@latest`, then run `npm run check:versions`. See [npm-versions.md](.claude/rules/npm-versions.md).
- Two browsers: every manifest change goes into both `public/manifest.json` and `public/manifest.firefox.json`. Use the `chrome.*` namespace only.
- Commits run the Husky pre-commit hook: it formats, stages all modified tracked files (`git add -u`, no partial commits) and builds and zips both browsers. See [AGENTS.md](AGENTS.md).
- Git safety: never run `commit`, `reset`, `rebase`, `push`, `pull --force`, `checkout --force`, `clean`, or `stash drop` unless the user explicitly asks; confirm before `git pull`, `git merge`, or `git stash`. In multi-agent work only the orchestrator runs git.

## Detailed rules (read on demand)

- Extension architecture: [`.claude/rules/extension-architecture.md`](.claude/rules/extension-architecture.md)
- GitHub DOM selectors: [`.claude/rules/github-dom-selectors.md`](.claude/rules/github-dom-selectors.md)
- npm versions: [`.claude/rules/npm-versions.md`](.claude/rules/npm-versions.md)
- Maintaining agent context: [`.claude/rules/maintaining-agent-context.md`](.claude/rules/maintaining-agent-context.md)

## Skills, commands and agents

- Skills (`.claude/skills/`): `chrome-extension-docs` (offline Chrome docs mirror plus Firefox notes), `hyperfriend-repo` (repo orientation).
- Slash commands (`.claude/commands/`): `/build`, `/watch`, `/lint`, `/format`, `/zip`.
- Subagents (`.claude/agents/`): `build-engineer`, `core-engineer`, `dom-engineer`, `popup-engineer`, `devops-engineer`, `qa-engineer`, `code-reviewer`, `technical-writer`. File ownership and the orchestration flow are described in [AGENTS.md](AGENTS.md).
