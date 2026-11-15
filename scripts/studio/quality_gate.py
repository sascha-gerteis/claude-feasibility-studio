#!/usr/bin/env python3
"""Automated quality gate for specialist and director deliverables (standard library only).

A report is "complete" on the dashboard only when its required deliverables exist AND this gate
passed. The gate checks structure and evidence hygiene, not truth: length, required sections, a
stated verdict, evidence-status labels, source citations that resolve to the agent's source
register, and minimum register contents. The result is written as
research/<agent>/quality_check.json (director: outputs/quality_check.json) and, when a study is
active, delivered to the dashboard like any other document.

  python3 scripts/studio/quality_gate.py <agent> [<agent> ...]
  python3 scripts/studio/quality_gate.py --all
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import studiolib as S  # noqa: E402

SPECIALISTS = [a for a in S.AGENTS if a != "head-of-market-research"]
LABELS = ["VERIFIED", "SPONSOR", "CALCULATED", "ESTIMATE", "ASSUMPTION", "PROJECTION", "UNKNOWN"]
VERDICT = re.compile(r"(CONDITIONAL GO|NO-GO|\bGO\b|DEFER)")
MIN_WORDS_SPECIALIST = 2500
MIN_WORDS_DIRECTOR = 4000
LOCATION = re.compile(r"(?:#?L\d+|line\s*\d+|§|section|table|footnote|\[\^\d+\])", re.I)


def study_config() -> dict:
    """research/00_director/study_config.json, e.g. {"evidence_base": "internal-document", "source_document": "...",
    "director_outputs": [...], "min_words": {...}}. Default: external research mode."""
    try:
        return json.loads((S.ROOT / "research" / "00_director" / "study_config.json").read_text("utf-8"))
    except (OSError, ValueError):
        return {}

SPECIALIST_SECTIONS = {
    "executive summary / thesis": r"executive|thesis|summary",
    "findings / evidence": r"finding|evidence",
    "risks": r"risk",
    "failure modes / disconfirming tests": r"fail|disconfirm|downside",
    "challenges to other agents": r"challenge|cross-agent|cross agent",
    "limitations / evidence gaps": r"limitation|gap",
    "decision gates / further diligence": r"gate|diligence|next step|recommend",
}


def read(path: Path) -> str | None:
    try:
        return path.read_text("utf-8")
    except OSError:
        return None


def rows(path: Path) -> list[dict]:
    text = read(path)
    if not text:
        return []
    return [r for r in csv.DictReader(io.StringIO(text)) if any((v or "").strip() for v in r.values())]


def headings(md: str) -> list[str]:
    return [m.group(2).strip() for m in re.finditer(r"^(#{1,6})\s+(.+)$", md, re.M)]


def check_specialist(agent: str) -> dict:
    base = S.ROOT / "research" / agent
    checks: list[dict] = []
    add = lambda name, ok, detail="": checks.append({"name": name, "passed": bool(ok), "detail": detail})  # noqa: E731
    md = read(base / "findings.md") or ""
    add("Full report exists", bool(md), "research/%s/findings.md" % agent)
    words = len(re.findall(r"\w+", md))
    add(f"Report length ≥ {MIN_WORDS_SPECIALIST} words", words >= MIN_WORDS_SPECIALIST, f"{words} words")
    heads = " | ".join(headings(md)).lower()
    missing = [k for k, rx in SPECIALIST_SECTIONS.items() if not re.search(rx, heads)]
    add("Required sections present", not missing, "missing: " + ", ".join(missing) if missing else "all present")
    vm = re.search(r"(?:preliminary verdict|discipline verdict|verdict)[^\n]*", md, re.I)
    verdict = VERDICT.search(vm.group(0).upper()) if vm and " / CONDITIONAL" not in vm.group(0).upper() else None
    add("States a verdict (GO / CONDITIONAL GO / DEFER / NO-GO)", bool(verdict), verdict.group(1) if verdict else "none found")
    used = [lbl for lbl in LABELS if re.search(r"\b%s\b" % lbl, md)]
    add("Uses ≥ 3 evidence-status labels", len(used) >= 3, ", ".join(used) or "none")

    src = rows(base / "sources.csv")
    add("Source register has ≥ 8 sources", len(src) >= 8, f"{len(src)} rows")
    if study_config().get("evidence_base") == "internal-document":
        located = [r for r in src if LOCATION.search(" ".join((r.get(k) or "") for k in ("document_url_or_path", "page_or_table", "title")))]
        add("≥ 6 sources trace to a location in the source document", len(located) >= 6, f"{len(located)} with line/section/table/footnote")
    else:
        with_url = [r for r in src if re.match(r"https?://", (r.get("document_url_or_path") or "").strip())]
        add("≥ 6 sources have a traceable URL", len(with_url) >= 6, f"{len(with_url)} with URL")
    ids = {(r.get("source_id") or "").strip() for r in src if (r.get("source_id") or "").strip()}
    cited = {i for i in ids if re.search(r"(?<![\w-])%s(?![\w-])" % re.escape(i), md)}
    add("Report cites ≥ 8 registered sources by ID", len(cited) >= 8, f"{len(cited)} of {len(ids)} cited")
    prefixes = {re.sub(r"\d+$", "", i) for i in ids if re.search(r"\d+$", i)}
    unresolved: set[str] = set()
    for p in prefixes:
        if len(p) < 2:
            continue
        for m in re.finditer(r"(?<![\w-])(%s\d+)(?![\w-])" % re.escape(p), md):
            if m.group(1) not in ids:
                unresolved.add(m.group(1))
    add("Every cited source ID resolves to the register", not unresolved, ", ".join(sorted(unresolved)[:10]) or "all resolve")

    asm = rows(base / "assumptions.csv")
    bad_status = [r.get("assumption_id") for r in asm if (r.get("status") or "").strip().upper() not in LABELS]
    add("Assumption register has ≥ 5 rows", len(asm) >= 5, f"{len(asm)} rows")
    add("Assumption statuses use the evidence labels", bool(asm) and not bad_status, ("no rows" if not asm else ", ".join(map(str, bad_status[:8])) or "ok"))
    risks = rows(base / "risks.csv")
    add("Risk register has ≥ 5 risks", len(risks) >= 5, f"{len(risks)} rows")
    fail_sec = re.search(r"^#{1,6}[^\n]*(?:fail|disconfirm)[^\n]*\n(.*?)(?=^#{1,6}\s|\Z)", md, re.I | re.M | re.S)
    n_fail = 0
    if fail_sec:
        body = fail_sec.group(1)
        n_fail = len(re.findall(r"^\s*(?:[-*]|\d+[.)])\s+\S", body, re.M)) + max(0, len([l for l in body.splitlines() if l.strip().startswith("|")]) - 2)
    add("≥ 3 explicit failure modes", n_fail >= 3, f"{n_fail} found")
    return {"checks": checks}


def check_director() -> dict:
    out = S.ROOT / "outputs"
    cfg = study_config()
    checks: list[dict] = []
    add = lambda name, ok, detail="": checks.append({"name": name, "passed": bool(ok), "detail": detail})  # noqa: E731
    for f in ["00_executive_summary.md", "01_feasibility_report.md", "02_financial_scenarios.md", "03_risk_register.csv",
              "04_recommendation.md", "source_register.csv", "assumption_register.csv", "disagreement_log.csv",
              *cfg.get("director_outputs", [])]:
        add(f"{f} exists", (out / f).is_file())
    rep = read(out / "01_feasibility_report.md") or ""
    words = len(re.findall(r"\w+", rep))
    add(f"Integrated report ≥ {MIN_WORDS_DIRECTOR} words", words >= MIN_WORDS_DIRECTOR, f"{words} words")
    for f, n in cfg.get("min_words", {}).items():
        w = len(re.findall(r"\w+", read(out / f) or ""))
        add(f"{f} ≥ {n} words", w >= n, f"{w} words")
    for f, n in cfg.get("min_rows", {}).items():
        k = len(rows(out / f))
        add(f"{f} has ≥ {n} rows", k >= n, f"{k} rows")
    rec = read(out / "04_recommendation.md") or ""
    vm = re.search(r"\*\*Verdict:\*\*\s*([^\n]+)", rec)
    verdict = VERDICT.search(vm.group(1).upper()) if vm and " / " not in vm.group(1) else None
    add("Recommendation states one verdict", bool(verdict), verdict.group(1) if verdict else "none / placeholder")
    names = ["investment", "project", "syndication", "real estate", "artificial intelligence|\\bai\\b", "environmental"]
    missing = [n for n in names if not re.search(n, rep, re.I)]
    add("Integrated report covers all six workstreams", not missing, ", ".join(missing) or "all covered")
    dis = rows(out / "disagreement_log.csv")
    add("Disagreement log has ≥ 3 entries", len(dis) >= 3, f"{len(dis)} rows")
    src = rows(out / "source_register.csv")
    need = int(cfg.get("min_consolidated_sources", 30))
    add(f"Consolidated source register has ≥ {need} sources", len(src) >= need, f"{len(src)} rows")
    gates = []
    for a in SPECIALISTS:
        q = read(S.ROOT / "research" / a / "quality_check.json")
        gates.append(bool(q) and json.loads(q).get("status") == "PASS")
    add("All six specialist reports passed their gate", all(gates), f"{sum(gates)} of 6 passed")
    return {"checks": checks}


def run(agent: str) -> str:
    res = check_director() if agent == "head-of-market-research" else check_specialist(agent)
    status = "PASS" if all(c["passed"] for c in res["checks"]) else "FAIL"
    payload = {"agent": agent, "status": status, "checked_at": S.now(), "gate": "studio quality_gate.py v1 (structure and citation checks)",
               "checks": res["checks"]}
    target = (S.ROOT / "outputs" / "quality_check.json") if agent == "head-of-market-research" else (S.ROOT / "research" / agent / "quality_check.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), "utf-8")
    cur = S.active_study()
    if cur:
        rel = target.relative_to(S.ROOT).as_posix()
        S.queue_document(cur["slug"], rel, agent)
        S.append_outbox(cur["slug"], [S.make_event(cur["slug"], "quality.check", agent=agent, data={"status": status, "path": rel})])
        S.flush(cur["slug"], timeout=10, block=True)
    failed = [c["name"] + (f" ({c['detail']})" if c.get("detail") else "") for c in res["checks"] if not c["passed"]]
    return f"{agent:28s} {status}" + ("" if not failed else "\n    - " + "\n    - ".join(failed))


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    agents = SPECIALISTS + ["head-of-market-research"] if args == ["--all"] else args
    for a in agents:
        if a not in S.AGENTS:
            print(f"unknown agent {a}", file=sys.stderr)
            sys.exit(2)
        print(run(a))


if __name__ == "__main__":
    main()
