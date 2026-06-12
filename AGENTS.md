@C:\Users\link\.codex\RTK.md

# AI Maintenance Rules

This project uses an AI feature-index driven maintenance workflow. For all future Codex tasks in this repository:

1. Read `docs/ai/PROJECT_INDEX.md` and `docs/ai/FEATURE_INDEX.md` before making changes.
2. Locate the relevant feature unit first, then read only that unit's P0 files by default.
3. Read P1 or P2 files only when the P0 files are insufficient, and state the reason before doing so.
4. Do not default to whole-project search. Use targeted file reads, CodeGraph if initialized, or narrow literal searches.
5. Do not read generated or heavy directories/files unless explicitly required:
   - `node_modules`
   - `dist`
   - `build`
   - `.next`
   - `coverage`
   - `.git`
   - large logs or generated artifacts
6. After changing behavior, update the relevant feature unit in `docs/ai/FEATURE_INDEX.md`.
7. After any AI-made change, append an entry to `docs/ai/CHANGELOG_AI.md`.
8. If the index conflicts with code, treat code as the source of truth and fix the index in the same task.
9. Do not perform unrelated refactors.
10. Do not upgrade dependencies unless the user explicitly asks.
11. Run the smallest necessary validation for the touched feature.
12. If CodeGraph is not initialized and structural exploration would help, ask the user before running `codegraph init -i`.

When updating the indexes, keep entries concise and practical: list exact files, important function anchors, API routes, state keys, and any uncertainty as `待确认`.
