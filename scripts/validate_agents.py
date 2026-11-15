#!/usr/bin/env python3
"""Static validator for the Feasibility Studio (agents, charter, workspace, templates, prompts).

Checks Claude Code subagent frontmatter against the documented schema, unique names, tool access, the Director's
delegation allowlist, and the presence of every shared file the agents reference. This is a static check; it does
not prove that a study ran. See prompts/SMOKE_TEST_DELEGATION.md for a live delegation test.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml  # type: ignore
except ImportError:  # pragma: no cover
    yaml = None

ROOT = Path(__file__).resolve().parents[1]
DIRECTOR = "head-of-market-research"
SPECIALISTS = ["investment-banking", "project-technology", "syndications",
               "real-estate-hospitality", "ai-strategy", "environmental-technologies"]
AGENTS = [DIRECTOR] + SPECIALISTS
KNOWN_FIELDS = {"name", "description", "tools", "disallowedTools", "model", "permissionMode", "maxTurns",
                "autoCompactWindow", "skills", "mcpServers", "hooks", "memory", "background", "omitClaudeMd",
                "effort", "isolation", "color", "initialPrompt", "experimental"}
MODELS = {"sonnet", "opus", "haiku", "fable", "inherit"}
COLORS = {"red", "blue", "green", "yellow", "purple", "orange", "pink", "cyan"}
REQUIRED_SPECIALIST_TOOLS = {"Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch"}
REQUIRED_FILES = [
    "CLAUDE.md", "README.md", "inputs/PROJECT_BRIEF.md", "inputs/README.md", "research/README.md",
    "models/MODEL_SPEC.md", "models/scripts/fincalc.py", "outputs/README.md",
    "templates/RESEARCH_PLAN_TEMPLATE.md", "templates/TASK_BRIEF_TEMPLATE.md", "templates/RUN_LOG_TEMPLATE.md",
    "templates/SPECIALIST_FINDINGS_TEMPLATE.md", "templates/CROSS_REVIEW_TEMPLATE.md",
    "templates/EXECUTIVE_SUMMARY_TEMPLATE.md", "templates/FINAL_REPORT_TEMPLATE.md",
    "templates/FINANCIAL_SCENARIOS_TEMPLATE.md", "templates/RECOMMENDATION_TEMPLATE.md",
    "templates/source_register.csv", "templates/assumption_register.csv", "templates/risk_register.csv",
    "templates/disagreement_log.csv",
    "prompts/START_FULL_STUDY.md", "prompts/START_MARKET_SCAN.md", "prompts/CHALLENGE_ROUND.md",
    "prompts/ORCHESTRATE_FALLBACK.md", "prompts/SMOKE_TEST_DELEGATION.md",
]
REQUIRED_DIRS = ["inputs/source_documents", "inputs/confidential", "research/00_director/task_briefs",
                 "research/cross-review", "models", "outputs", "templates", "prompts"] + \
                [f"research/{s}" for s in SPECIALISTS]

errors: list[str] = []
warnings: list[str] = []


def parse_frontmatter(path: Path) -> dict | None:
    text = path.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.S)
    if not m:
        errors.append(f"{path.name}: missing or malformed YAML frontmatter")
        return None
    raw, body = m.group(1), m.group(2)
    if yaml:
        try:
            fm = yaml.safe_load(raw)
        except yaml.YAMLError as exc:
            errors.append(f"{path.name}: YAML parse error: {exc}")
            return None
    else:
        fm = dict(re.findall(r"^([A-Za-z]+):\s*(.*)$", raw, re.M))
    if not isinstance(fm, dict):
        errors.append(f"{path.name}: frontmatter is not a mapping")
        return None
    if len(body.strip()) < 500:
        errors.append(f"{path.name}: system prompt body is suspiciously short")
    fm["__body__"] = body
    return fm


def tool_list(value) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value]
    # split on commas not inside parentheses
    return [t.strip() for t in re.split(r",\s*(?![^()]*\))", str(value or "")) if t.strip()]


for d in REQUIRED_DIRS:
    if not (ROOT / d).is_dir():
        errors.append(f"missing directory {d}/")
for f in REQUIRED_FILES:
    if not (ROOT / f).is_file():
        errors.append(f"missing file {f}")

agent_dir = ROOT / ".claude" / "agents"
paths = sorted(agent_dir.glob("*.md"))
names: dict[str, Path] = {}
for p in paths:
    fm = parse_frontmatter(p)
    if fm is None:
        continue
    name = fm.get("name")
    for key in ("name", "description"):
        if not fm.get(key):
            errors.append(f"{p.name}: required field '{key}' missing")
    if name and not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", str(name)):
        errors.append(f"{p.name}: name '{name}' must be lowercase letters, digits and hyphens")
    if name and name != p.stem:
        errors.append(f"{p.name}: name '{name}' does not match filename")
    if name in names:
        errors.append(f"duplicate agent name '{name}' in {p.name} and {names[name].name}")
    names[name] = p
    unknown = set(fm) - KNOWN_FIELDS - {"__body__"}
    if unknown:
        errors.append(f"{p.name}: unrecognised frontmatter fields {sorted(unknown)}")
    model = str(fm.get("model", "inherit"))
    if model not in MODELS and not model.startswith("claude-"):
        errors.append(f"{p.name}: invalid model '{model}'")
    if fm.get("color") and fm["color"] not in COLORS:
        errors.append(f"{p.name}: invalid color '{fm['color']}'")
    tools = tool_list(fm.get("tools"))
    base = {re.sub(r"\(.*\)$", "", t) for t in tools}
    if name in SPECIALISTS:
        missing = REQUIRED_SPECIALIST_TOOLS - base
        if missing:
            errors.append(f"{p.name}: specialist missing tools {sorted(missing)}")
        if "Agent" in base or "Task" in base:
            warnings.append(f"{p.name}: specialist can spawn agents (not required)")
    if name == DIRECTOR:
        agent_tool = next((t for t in tools if t.startswith("Agent")), None)
        if not agent_tool:
            errors.append(f"{p.name}: Director lacks the Agent tool and cannot delegate")
        elif "(" in agent_tool:
            allowed = {a.strip() for a in agent_tool[agent_tool.index("(") + 1:-1].split(",")}
            for s in SPECIALISTS:
                if s not in allowed:
                    errors.append(f"{p.name}: Agent allowlist missing '{s}'")
            for a in allowed - set(SPECIALISTS):
                errors.append(f"{p.name}: Agent allowlist names unknown agent '{a}'")
        for need in ("Write", "Read"):
            if need not in base:
                errors.append(f"{p.name}: Director missing tool {need}")
        for s in SPECIALISTS:
            if s not in fm["__body__"]:
                errors.append(f"{p.name}: Director instructions never mention '{s}'")
    if name in AGENTS and "CLAUDE.md" not in fm["__body__"]:
        errors.append(f"{p.name}: does not instruct the agent to read CLAUDE.md")

for a in AGENTS:
    if a not in names:
        errors.append(f"missing agent definition .claude/agents/{a}.md")
for extra in set(names) - set(AGENTS):
    warnings.append(f"extra agent present: {extra}")

# Every templates/... or prompts/... path referenced by agents or the charter must exist
refs = set()
for p in list(paths) + [ROOT / "CLAUDE.md"] + list((ROOT / "prompts").glob("*.md")):
    refs |= set(re.findall(r"`((?:templates|prompts|models)/[A-Za-z0-9_./-]+\.(?:md|csv|py))`", p.read_text("utf-8")))
for r in sorted(refs):
    if not (ROOT / r).is_file():
        errors.append(f"referenced file does not exist: {r}")

# Nested archives / stray extraction directories
for z in ROOT.rglob("*.zip"):
    if "docs" not in z.parts:
        warnings.append(f"unextracted archive outside docs/: {z.relative_to(ROOT)}")
for nested in ROOT.rglob(".claude/agents"):
    if nested != agent_dir:
        errors.append(f"nested agent directory not discoverable by Claude Code: {nested.relative_to(ROOT)}")

for w in warnings:
    print("WARN:", w)
if errors:
    print("FAILED:")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"PASS: {len(names)} agents ({', '.join(sorted(names))}); frontmatter valid; Director can delegate to all "
      f"{len(SPECIALISTS)} specialists; {len(REQUIRED_FILES)} shared files, {len(refs)} referenced paths and "
      f"{len(REQUIRED_DIRS)} workspace directories present.")
