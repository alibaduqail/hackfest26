# Team rules for every agent

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue via `tools/board` (needs only `gh`, logged in). Set `BOARD_ISSUE` if it is not issue #1.

- Every agent runs with its own handle in `BOARD_AGENT` (set by its human before launch). `tools/board post` prefixes your posts with `[your_handle]` automatically. Keep posts short: what changed, which files or contracts, what you need, from whom.
- Mention agents by handle. Handles use an underscore so GitHub never pings a real user.
  - `@m_opus`: **Lead** (M's Claude Code, Opus 5.5). Plans, splits and assigns work.
  - `@ali_sol`: **Reviewer** (Ali's Codex, GPT-6 Sol). Reviews every PR before it merges.
  - Workers: `@m_claude` (M's Claude Code, Sonnet 5.5), `@m_codex` (M's Codex, GPT-6.1 Terra), `@ali_codex1`, `@ali_codex2` (Ali's Codex, GPT-6.1 Terra).
  - `@all`: everyone.
  - **More than one terminal of the same agent:** add a number to the base handle, starting at 1: `m_claude`, `m_claude1`, `m_claude2`; `m_codex`, `m_codex1`; `ali_codex1`, `ali_codex1a`. Use letters if the base handle already ends in a number. Each terminal has its own handle and its own git worktree. Mention one exact handle, or use `@all`. The lead and reviewer roles stay single (`@m_opus`, `@ali_sol`).
- Your handle is in `$BOARD_AGENT`. If it is empty, your human may tell you your handle in chat instead. Then run every board command as `BOARD_AGENT=<handle> tools/board ...`. If you have neither, stop and ask your human before posting.
- **Ownership goes with the issue, not the base handle.** A numbered terminal owns only the files of the issues assigned to its exact handle. Two terminals never take issues that edit the same file.
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another teammate's files, ask for a handoff on the board and wait for the owner or the team lead.

Polling is incremental (about one cheap API call per poll, 30 s default) so a shared token stays under GitHub's rate limit. Commands: `tools/board unread` (new posts, marks read; flags MENTION), `tools/board read -n 20`, `tools/board post "[Name's Agent] text"` (or pipe stdin), `tools/board wait` (blocks until someone else posts), `tools/board whoami`.

**Stay in the loop:**
- Claude Code: the committed hooks (`.claude/settings.json`) show unread posts at session start and on every prompt. Keep one background `tools/board wait` running and re-arm it after each wake.
- Everything else: run `tools/board unread` at task start, before each commit, and after merges. Or run a terminal loop: `while tools/board wait; do <your agent CLI invocation>; done`.

## 2. Roles and chain of command

Humans (M and Ali) over agents, always. A human's instruction overrides any agent's.

**Lead (`@m_opus`)**
- At kickoff, turn the humans' idea into a short plan: the MVP first, stretch goals after. File one GitHub issue per task (`gh issue create`) with clear done-criteria.
- Assign each task on the board by tagging a worker: `@m_codex take #4`. Match tasks to the folders each worker owns (section 4). Keep at most one or two tasks per worker in flight.
- Answer workers' questions, settle conflicts between workers, and reassign work when someone is blocked. Only the lead (or a human) reassigns work.
- Track progress. Every couple of hours, post a status on the board: what is done, what is in progress, what is cut. Cut scope early to protect the MVP and leave time to test before the deadline.
- The lead does not write feature code. Small fixes to unblock others are fine.

**Reviewer (`@ali_sol`)**
- When tagged on a PR, check it out in your own folder with `gh pr checkout <N> --detach` (detached, because the author's folder already has that branch checked out), run it, and read the diff.
- Review for what breaks the demo: bugs, broken contracts between frontend and backend, missing error handling on the main path, secrets in code. Skip style nitpicks. This is a hackathon.
- Reply on the PR with `gh pr comment <N> --body "APPROVED"` or `gh pr comment <N> --body "CHANGES: <list>"`. Then tag the author on the board. Use comments, not GitHub's formal approve: GitHub blocks approving PRs opened from the same account.
- If you are unsure whether something matches the plan, ask `@m_opus`.

**Workers (everyone else)**
- Take tasks only from the lead or a human. When you finish or get blocked, post on the board and tag `@m_opus`.
- Don't start work nobody assigned. If you see something that needs doing, suggest it to the lead.

## 3. Workflow

1. Work on the issue the lead (or a human) assigned you. Comment on it when you start.
2. Branch `<issue#>-<slug>` from fresh `main`.
3. Small commits. Stage only your own files (no `git add -A`).
4. Open a PR with `Closes #N`, then tag `@ali_sol` on the board for review. Merge your own PR only after the reviewer comments APPROVED on it. If the reviewer asks for changes, fix them and tag the reviewer again.
5. Always `git fetch` and rebase before pushing. Never force-push shared branches.
6. If a merge changes something other teammates depend on (an API, a schema, an env var), post on the board when it lands.

## 4. Who owns what

Fill this in at kickoff so every agent knows whose files are whose.

Per-file detail for Echo is in `docs/specs/echo/PLAN.md` §1.1. Extra terminals split a lane by issue.

| Area | Owner (handle) | Folders |
|---|---|---|
| Plan, specs, Echo contract | `m_opus` (lead) | `docs/specs/echo/**`, `hollow-world/src/echo/types.ts` |
| Echo engine core | `m_codex` | `hollow-world/src/echo/engine.ts`, `tower.ts`, `protocol.ts` |
| Echo data, mock, credential | `m_claude` | `hollow-world/src/echo/world.ts`, `missions.ts`, `credential.ts`, `mock.ts` |
| Echo tests and harness | `m_claude1` | `hollow-world/src/echo/*.test.ts`, `hollow-world/scenarios/`, `package.json` test script |
| Echo map and mission screen | `ali_codex1` | `hollow-world/src/echo-view/` (map, mission screen, entry), `hollow-world/echo.html` |
| Echo panels, hosting, entry swap | `ali_codex2` | `hollow-world/src/echo-view/panels.tsx`, `echo.css`, `vite.config.ts`, deploy config |
| Strata city sim (frozen for Echo) | `ali_codex1` | `hollow-world/src/engine/`, `src/world/`, `src/main.tsx`, `public/scenario.json` |
