# Run Log — [Project name]

Record **only runs that actually happened.** A delegation that errored, timed out or was not attempted is logged with
that status. Never mark a run COMPLETED unless its result was returned and its output files exist.

**Orchestration mode:** NESTED (Director as main thread via `claude --agent`) / NESTED (Director as subagent) / FALLBACK (main session orchestrates)

| # | Stage | Agent | Task | Invoked by | Started | Ended | Status (COMPLETED / PARTIAL / FAILED / NOT RUN) | Output path(s) | Notes / limitations |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
